// Keep this browser entry point relative so the repository remains runnable when
// GitHub Pages serves the source tree directly, without Vite rewriting imports.
import { deleteDB, openDB } from '../../vendor/idb.js';
import {
  QUOTE_RECORD_SCHEMA_VERSION,
  buildDisplayNumber,
  canonicalJson,
  cloneQuoteData,
  createQuoteSearchText,
  formatBaseQuoteNumber,
  hashQuoteContent,
  legacyQuoteToQuoteContent,
  normalizeQuoteContent,
  validateQuoteContent,
  validateQuoteRecord,
  validateQuoteVersion
} from '../domain/quote-library.js';

export const QUOTE_LIBRARY_DATABASE_NAME = 'gtm_quote_manager';
export const QUOTE_LIBRARY_DATABASE_VERSION = 1;

export const QUOTE_LIBRARY_STORES = Object.freeze({
  quotes: 'quotes',
  quoteVersions: 'quoteVersions',
  quoteEvents: 'quoteEvents',
  customers: 'customers',
  contacts: 'contacts',
  settings: 'settings',
  recoveryRecords: 'recoveryRecords',
  migrationLog: 'migrationLog'
});

function defaultIdFactory() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function defaultNow() {
  return new Date().toISOString();
}

function createStores(database, transaction) {
  const quotes = database.createObjectStore(QUOTE_LIBRARY_STORES.quotes, { keyPath: 'id' });
  quotes.createIndex('baseNumber', 'baseNumber', { unique: true });
  quotes.createIndex('currentStatus', 'currentStatus');
  quotes.createIndex('customerId', 'customerId');
  quotes.createIndex('customerSearchText', 'customerSearchText');
  quotes.createIndex('updatedAt', 'updatedAt');

  const versions = database.createObjectStore(QUOTE_LIBRARY_STORES.quoteVersions, { keyPath: 'id' });
  versions.createIndex('displayNumber', 'displayNumber', { unique: true });
  versions.createIndex('quoteId', 'quoteId');
  versions.createIndex('quoteRevision', ['quoteId', 'revisionNumber'], { unique: true });
  versions.createIndex('finalizedAt', 'finalizedAt');

  const events = database.createObjectStore(QUOTE_LIBRARY_STORES.quoteEvents, { keyPath: 'id' });
  events.createIndex('quoteId', 'quoteId');
  events.createIndex('quoteVersionId', 'quoteVersionId');
  events.createIndex('occurredAt', 'occurredAt');
  events.createIndex('type', 'type');

  const customers = database.createObjectStore(QUOTE_LIBRARY_STORES.customers, { keyPath: 'id' });
  customers.createIndex('normalizedName', 'normalizedName');
  customers.createIndex('updatedAt', 'updatedAt');

  const contacts = database.createObjectStore(QUOTE_LIBRARY_STORES.contacts, { keyPath: 'id' });
  contacts.createIndex('customerId', 'customerId');
  contacts.createIndex('email', 'email');
  contacts.createIndex('customerPrimary', ['customerId', 'isPrimary']);

  database.createObjectStore(QUOTE_LIBRARY_STORES.settings, { keyPath: 'id' });

  const recovery = database.createObjectStore(QUOTE_LIBRARY_STORES.recoveryRecords, { keyPath: 'id' });
  recovery.createIndex('storeName', 'storeName');
  recovery.createIndex('detectedAt', 'detectedAt');

  database.createObjectStore(QUOTE_LIBRARY_STORES.migrationLog, { keyPath: 'version' });
  transaction.objectStore(QUOTE_LIBRARY_STORES.migrationLog).put({
    version: 1,
    appliedAt: defaultNow(),
    description: 'Created the local quote-library foundation stores.'
  });
}

function createSettings(idFactory, now) {
  return {
    id: 'application',
    schemaVersion: QUOTE_RECORD_SCHEMA_VERSION,
    deviceId: idFactory(),
    numbering: {},
    updatedAt: now()
  };
}

function eventRecord({ idFactory, now, quoteId, quoteVersionId, type, metadata }) {
  return {
    id: idFactory(),
    schemaVersion: QUOTE_RECORD_SCHEMA_VERSION,
    quoteId,
    quoteVersionId: quoteVersionId || undefined,
    type,
    occurredAt: now(),
    metadata: metadata || undefined
  };
}

function assertValidContent(content) {
  const normalized = normalizeQuoteContent(content);
  const errors = validateQuoteContent(normalized);
  if (errors.length) throw new Error(`Quote content is invalid: ${errors.join(' ')}`);
  return normalized;
}

function normalizeSearchText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export class QuoteDraftConflictError extends Error {
  constructor() {
    super('This draft was changed in another tab. Reopen it before saving again.');
    this.name = 'QuoteDraftConflictError';
  }
}

export function createQuoteLibraryRepository({
  databaseName = QUOTE_LIBRARY_DATABASE_NAME,
  idFactory = defaultIdFactory,
  now = defaultNow,
  cryptoProvider = globalThis.crypto
} = {}) {
  let databasePromise;

  function openDatabase() {
    if (!databasePromise) {
      databasePromise = openDB(databaseName, QUOTE_LIBRARY_DATABASE_VERSION, {
        upgrade(database, oldVersion, newVersion, transaction) {
          if (oldVersion < 1) createStores(database, transaction);
        },
        blocking() {
          databasePromise?.then((database) => database.close());
          databasePromise = undefined;
        },
        terminated() {
          databasePromise = undefined;
        }
      });
    }
    return databasePromise;
  }

  async function ensureSettings() {
    const database = await openDatabase();
    const transaction = database.transaction(QUOTE_LIBRARY_STORES.settings, 'readwrite');
    let settings = await transaction.store.get('application');
    if (!settings) {
      settings = createSettings(idFactory, now);
      await transaction.store.add(settings);
    }
    await transaction.done;
    return cloneQuoteData(settings);
  }

  async function quarantineRecord(storeName, rawRecord, errors) {
    const database = await openDatabase();
    const transaction = database.transaction([storeName, QUOTE_LIBRARY_STORES.recoveryRecords], 'readwrite');
    await transaction.objectStore(QUOTE_LIBRARY_STORES.recoveryRecords).add({
      id: idFactory(),
      schemaVersion: QUOTE_RECORD_SCHEMA_VERSION,
      storeName,
      originalKey: String(rawRecord?.id ?? ''),
      detectedAt: now(),
      errors: [...errors],
      rawRecord: cloneQuoteData(rawRecord)
    });
    if (rawRecord?.id != null) await transaction.objectStore(storeName).delete(rawRecord.id);
    await transaction.done;
  }

  async function validateStoredRecord(storeName, record, validator) {
    if (!record) return undefined;
    const errors = validator(record);
    if (errors.length) {
      await quarantineRecord(storeName, record, errors);
      return undefined;
    }
    return cloneQuoteData(record);
  }

  async function createDraft(content, {
    sourceQuoteId,
    sourceQuoteVersionId,
    customerId,
    contactId
  } = {}) {
    const normalized = assertValidContent(content);
    const database = await openDatabase();
    const settings = await ensureSettings();
    const timestamp = now();
    const quote = {
      id: idFactory(),
      schemaVersion: QUOTE_RECORD_SCHEMA_VERSION,
      originDeviceId: settings.deviceId,
      currentStatus: 'draft',
      draftRevision: 0,
      versionIds: [],
      workingDraft: {
        kind: 'base',
        content: cloneQuoteData(normalized),
        lastSavedAt: timestamp
      },
      sourceQuoteId: sourceQuoteId || undefined,
      sourceQuoteVersionId: sourceQuoteVersionId || undefined,
      customerId: customerId || undefined,
      contactId: contactId || undefined,
      customerSearchText: createQuoteSearchText(normalized),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const event = eventRecord({
      idFactory,
      now,
      quoteId: quote.id,
      type: sourceQuoteId ? 'duplicated' : 'created',
      metadata: sourceQuoteId ? { sourceQuoteId, sourceQuoteVersionId: sourceQuoteVersionId || null } : undefined
    });
    const transaction = database.transaction([QUOTE_LIBRARY_STORES.quotes, QUOTE_LIBRARY_STORES.quoteEvents], 'readwrite');
    await transaction.objectStore(QUOTE_LIBRARY_STORES.quotes).add(quote);
    await transaction.objectStore(QUOTE_LIBRARY_STORES.quoteEvents).add(event);
    await transaction.done;
    return cloneQuoteData(quote);
  }

  async function createDraftFromLegacyQuote(legacyQuote, options = {}) {
    return createDraft(legacyQuoteToQuoteContent(legacyQuote, { fallbackDate: options.fallbackDate }), options);
  }

  async function getQuote(quoteId) {
    const database = await openDatabase();
    const record = await database.get(QUOTE_LIBRARY_STORES.quotes, quoteId);
    return validateStoredRecord(QUOTE_LIBRARY_STORES.quotes, record, validateQuoteRecord);
  }

  async function saveDraftContent(quoteId, content, options = {}) {
    const { expectedRevision } = options;
    const normalized = assertValidContent(content);
    const database = await openDatabase();
    const transaction = database.transaction(QUOTE_LIBRARY_STORES.quotes, 'readwrite');
    const quote = await transaction.store.get(quoteId);
    const errors = validateQuoteRecord(quote);
    if (errors.length) {
      throw new Error(`Cannot save an invalid quote record: ${errors.join(' ')}`);
    }
    if (!quote.workingDraft) {
      throw new Error('Finalized quote versions are immutable. Start a revision before editing.');
    }
    const currentRevision = Number.isInteger(quote.draftRevision) ? quote.draftRevision : 0;
    if (expectedRevision != null && expectedRevision !== currentRevision) {
      throw new QuoteDraftConflictError();
    }
    const timestamp = now();
    quote.workingDraft.content = cloneQuoteData(normalized);
    quote.workingDraft.lastSavedAt = timestamp;
    quote.draftRevision = currentRevision + 1;
    if (Object.hasOwn(options, 'customerId')) quote.customerId = options.customerId || undefined;
    if (Object.hasOwn(options, 'contactId')) quote.contactId = options.contactId || undefined;
    quote.customerSearchText = createQuoteSearchText(normalized, quote.baseNumber);
    quote.updatedAt = timestamp;
    await transaction.store.put(quote);
    await transaction.done;
    return cloneQuoteData(quote);
  }

  async function upsertCustomerAndContact(customers, contacts, normalized, {
    customerId,
    contactId
  } = {}, timestamp = now()) {
    const companyName = normalized.customer.companyName;
    if (!companyName) return { customerId: undefined, contactId: undefined };
    const normalizedName = normalizeSearchText(companyName);
    let customer = customerId ? await customers.get(customerId) : undefined;
    if (!customer) {
      const matches = await customers.index('normalizedName').getAll(normalizedName);
      customer = matches[0];
    }
    if (customer) {
      customer.companyName = companyName;
      customer.normalizedName = normalizedName;
      customer.addressText = normalized.customer.addressText;
      customer.defaultPaymentTerms = normalized.paymentTerms;
      customer.updatedAt = timestamp;
      await customers.put(customer);
    } else {
      customer = {
        id: idFactory(),
        schemaVersion: QUOTE_RECORD_SCHEMA_VERSION,
        companyName,
        normalizedName,
        addressText: normalized.customer.addressText,
        defaultPaymentTerms: normalized.paymentTerms,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await customers.add(customer);
    }

    const hasContact = Boolean(
      normalized.contact.buyerName ||
      normalized.contact.email ||
      normalized.contact.phone
    );
    let contact;
    if (hasContact) {
      const customerContacts = await contacts.index('customerId').getAll(customer.id);
      contact = contactId ? await contacts.get(contactId) : undefined;
      if (!contact || contact.customerId !== customer.id) {
        const normalizedEmail = normalizeSearchText(normalized.contact.email);
        const normalizedContactName = normalizeSearchText(normalized.contact.buyerName);
        contact = customerContacts.find((candidate) => (
          (normalizedEmail && candidate.normalizedEmail === normalizedEmail) ||
          (!normalizedEmail && normalizedContactName && candidate.normalizedName === normalizedContactName)
        ));
      }
      if (contact) {
        contact.name = normalized.contact.buyerName;
        contact.normalizedName = normalizeSearchText(normalized.contact.buyerName);
        contact.email = normalized.contact.email;
        contact.normalizedEmail = normalizeSearchText(normalized.contact.email);
        contact.phone = normalized.contact.phone;
        contact.isPrimary = true;
        contact.updatedAt = timestamp;
        await contacts.put(contact);
      } else {
        contact = {
          id: idFactory(),
          schemaVersion: QUOTE_RECORD_SCHEMA_VERSION,
          customerId: customer.id,
          name: normalized.contact.buyerName,
          normalizedName: normalizeSearchText(normalized.contact.buyerName),
          email: normalized.contact.email,
          normalizedEmail: normalizeSearchText(normalized.contact.email),
          phone: normalized.contact.phone,
          isPrimary: true,
          createdAt: timestamp,
          updatedAt: timestamp
        };
        await contacts.add(contact);
      }
      for (const candidate of customerContacts) {
        if (candidate.id !== contact.id && candidate.isPrimary) {
          candidate.isPrimary = false;
          candidate.updatedAt = timestamp;
          await contacts.put(candidate);
        }
      }
    }
    return { customerId: customer.id, contactId: contact?.id };
  }

  async function saveCustomerAndContact(content, links = {}) {
    const normalized = assertValidContent(content);
    const database = await openDatabase();
    const transaction = database.transaction([
      QUOTE_LIBRARY_STORES.customers,
      QUOTE_LIBRARY_STORES.contacts
    ], 'readwrite');
    const result = await upsertCustomerAndContact(
      transaction.objectStore(QUOTE_LIBRARY_STORES.customers),
      transaction.objectStore(QUOTE_LIBRARY_STORES.contacts),
      normalized,
      links
    );
    await transaction.done;
    return result;
  }

  async function saveDraftWithCustomer(quoteId, content, { expectedRevision } = {}) {
    const normalized = assertValidContent(content);
    const database = await openDatabase();
    const transaction = database.transaction([
      QUOTE_LIBRARY_STORES.quotes,
      QUOTE_LIBRARY_STORES.customers,
      QUOTE_LIBRARY_STORES.contacts
    ], 'readwrite');
    const quotes = transaction.objectStore(QUOTE_LIBRARY_STORES.quotes);
    const quote = await quotes.get(quoteId);
    const errors = validateQuoteRecord(quote);
    if (errors.length) throw new Error(`Cannot save an invalid quote record: ${errors.join(' ')}`);
    if (!quote.workingDraft) throw new Error('Finalized quote versions are immutable. Start a revision before editing.');
    const currentRevision = Number.isInteger(quote.draftRevision) ? quote.draftRevision : 0;
    if (expectedRevision != null && expectedRevision !== currentRevision) throw new QuoteDraftConflictError();

    const timestamp = now();
    const links = await upsertCustomerAndContact(
      transaction.objectStore(QUOTE_LIBRARY_STORES.customers),
      transaction.objectStore(QUOTE_LIBRARY_STORES.contacts),
      normalized,
      { customerId: quote.customerId, contactId: quote.contactId },
      timestamp
    );
    quote.workingDraft.content = cloneQuoteData(normalized);
    quote.workingDraft.lastSavedAt = timestamp;
    quote.draftRevision = currentRevision + 1;
    quote.customerId = links.customerId;
    quote.contactId = links.contactId;
    quote.customerSearchText = createQuoteSearchText(normalized, quote.baseNumber);
    quote.updatedAt = timestamp;
    await quotes.put(quote);
    await transaction.done;
    return cloneQuoteData(quote);
  }

  async function getCustomer(customerId) {
    const database = await openDatabase();
    const customer = await database.get(QUOTE_LIBRARY_STORES.customers, customerId);
    return customer ? cloneQuoteData(customer) : undefined;
  }

  async function getContact(contactId) {
    const database = await openDatabase();
    const contact = await database.get(QUOTE_LIBRARY_STORES.contacts, contactId);
    return contact ? cloneQuoteData(contact) : undefined;
  }

  async function listContacts(customerId) {
    const database = await openDatabase();
    const contacts = await database.getAllFromIndex(QUOTE_LIBRARY_STORES.contacts, 'customerId', customerId);
    return contacts
      .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary) || right.updatedAt.localeCompare(left.updatedAt))
      .map(cloneQuoteData);
  }

  async function searchCustomers({ query = '', limit = 50 } = {}) {
    const database = await openDatabase();
    const customers = await database.getAll(QUOTE_LIBRARY_STORES.customers);
    const normalizedQuery = normalizeSearchText(query);
    return customers
      .filter((customer) => !normalizedQuery || [
        customer.normalizedName,
        normalizeSearchText(customer.addressText)
      ].some((value) => value.includes(normalizedQuery)))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, Math.max(0, limit))
      .map(cloneQuoteData);
  }

  async function searchQuotes({ query = '', status, limit = 100 } = {}) {
    const database = await openDatabase();
    const records = await database.getAll(QUOTE_LIBRARY_STORES.quotes);
    const normalizedQuery = String(query).trim().toLocaleLowerCase();
    const valid = [];
    for (const record of records) {
      const checked = await validateStoredRecord(QUOTE_LIBRARY_STORES.quotes, record, validateQuoteRecord);
      if (!checked) continue;
      if (status && checked.currentStatus !== status) continue;
      if (normalizedQuery && !String(checked.customerSearchText || '').includes(normalizedQuery)) continue;
      valid.push(checked);
    }
    return valid
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, Math.max(0, limit));
  }

  async function getVersion(versionId) {
    const database = await openDatabase();
    const record = await database.get(QUOTE_LIBRARY_STORES.quoteVersions, versionId);
    const checked = await validateStoredRecord(QUOTE_LIBRARY_STORES.quoteVersions, record, validateQuoteVersion);
    if (!checked) return undefined;
    const actualHash = await hashQuoteContent(checked.content, cryptoProvider);
    if (actualHash !== checked.contentHash) {
      await quarantineRecord(QUOTE_LIBRARY_STORES.quoteVersions, checked, ['Finalized content hash does not match.']);
      return undefined;
    }
    return checked;
  }

  async function listVersions(quoteId) {
    const database = await openDatabase();
    const records = await database.getAllFromIndex(QUOTE_LIBRARY_STORES.quoteVersions, 'quoteId', quoteId);
    const versions = [];
    for (const record of records) {
      const checked = await getVersion(record.id);
      if (checked) versions.push(checked);
    }
    return versions.sort((left, right) => left.revisionNumber - right.revisionNumber);
  }

  async function finalizeBase(quoteId, { numberYear } = {}) {
    const existing = await getQuote(quoteId);
    if (!existing?.workingDraft || existing.workingDraft.kind !== 'base' || existing.baseNumber) {
      throw new Error('Only an unnumbered base draft can be finalized.');
    }
    const content = cloneQuoteData(existing.workingDraft.content);
    const contentHash = await hashQuoteContent(content, cryptoProvider);
    const database = await openDatabase();
    const timestamp = now();
    const versionId = idFactory();
    const transaction = database.transaction([
      QUOTE_LIBRARY_STORES.quotes,
      QUOTE_LIBRARY_STORES.quoteVersions,
      QUOTE_LIBRARY_STORES.quoteEvents,
      QUOTE_LIBRARY_STORES.settings
    ], 'readwrite');
    const quotes = transaction.objectStore(QUOTE_LIBRARY_STORES.quotes);
    const versions = transaction.objectStore(QUOTE_LIBRARY_STORES.quoteVersions);
    const events = transaction.objectStore(QUOTE_LIBRARY_STORES.quoteEvents);
    const settingsStore = transaction.objectStore(QUOTE_LIBRARY_STORES.settings);
    const current = await quotes.get(quoteId);
    if (!current?.workingDraft || current.workingDraft.kind !== 'base' || current.baseNumber) {
      throw new Error('The draft changed before it could be finalized.');
    }
    if (canonicalJson(current.workingDraft.content) !== canonicalJson(content)) {
      throw new Error('The draft changed before it could be finalized. Save and try again.');
    }
    const year = Number(numberYear);
    if (!Number.isInteger(year) || year < 2000 || year > 9999) {
      throw new Error('A four-digit business year is required to finalize a quote.');
    }
    const settings = await settingsStore.get('application');
    const previousSequence = settings.numbering[String(year)]?.lastBaseSequence || 0;
    const nextSequence = previousSequence + 1;
    const baseNumber = formatBaseQuoteNumber(year, nextSequence);
    const version = {
      id: versionId,
      schemaVersion: QUOTE_RECORD_SCHEMA_VERSION,
      quoteId,
      baseNumber,
      revisionNumber: 0,
      displayNumber: baseNumber,
      content,
      calculationPolicyVersion: 'legacy-markup-v1',
      pdfTemplateVersion: 'vision-quotation-v1',
      contentHash,
      finalizedAt: timestamp,
      createdAt: timestamp
    };
    settings.numbering[String(year)] = { year, lastBaseSequence: nextSequence };
    settings.updatedAt = timestamp;
    current.baseNumber = baseNumber;
    current.currentStatus = 'finalized';
    current.latestVersionId = versionId;
    current.versionIds = [...current.versionIds, versionId];
    delete current.workingDraft;
    current.customerSearchText = createQuoteSearchText(content, baseNumber);
    current.updatedAt = timestamp;
    await settingsStore.put(settings);
    await versions.add(version);
    await quotes.put(current);
    await events.add(eventRecord({ idFactory, now, quoteId, quoteVersionId: versionId, type: 'finalized' }));
    await transaction.done;
    return cloneQuoteData(version);
  }

  async function startRevision(quoteId, versionId) {
    const sourceVersion = await getVersion(versionId);
    if (!sourceVersion || sourceVersion.quoteId !== quoteId) throw new Error('The selected finalized version was not found for this quote.');
    const database = await openDatabase();
    const transaction = database.transaction([
      QUOTE_LIBRARY_STORES.quotes,
      QUOTE_LIBRARY_STORES.quoteVersions,
      QUOTE_LIBRARY_STORES.quoteEvents
    ], 'readwrite');
    const versions = transaction.objectStore(QUOTE_LIBRARY_STORES.quoteVersions);
    const quote = await transaction.objectStore(QUOTE_LIBRARY_STORES.quotes).get(quoteId);
    if (!quote?.baseNumber || quote.workingDraft) {
      throw new Error('Finish or discard the existing working draft before starting a revision.');
    }
    const currentSource = await versions.get(versionId);
    if (!currentSource || currentSource.contentHash !== sourceVersion.contentHash) {
      throw new Error('The selected finalized version changed before the revision could start.');
    }
    const existingVersions = await versions.index('quoteId').getAll(quoteId);
    const proposedRevisionNumber = Math.max(...existingVersions.map((version) => version.revisionNumber), 0) + 1;
    const timestamp = now();
    quote.workingDraft = {
      kind: 'revision',
      basedOnVersionId: versionId,
      proposedRevisionNumber,
      content: cloneQuoteData(sourceVersion.content),
      lastSavedAt: timestamp
    };
    quote.draftRevision = (Number.isInteger(quote.draftRevision) ? quote.draftRevision : 0) + 1;
    quote.updatedAt = timestamp;
    await transaction.objectStore(QUOTE_LIBRARY_STORES.quotes).put(quote);
    await transaction.objectStore(QUOTE_LIBRARY_STORES.quoteEvents).add(eventRecord({
      idFactory,
      now,
      quoteId,
      quoteVersionId: versionId,
      type: 'revision_started'
    }));
    await transaction.done;
    return cloneQuoteData(quote);
  }

  async function finalizeRevision(quoteId) {
    const existing = await getQuote(quoteId);
    if (!existing?.workingDraft || existing.workingDraft.kind !== 'revision' || !existing.baseNumber) {
      throw new Error('Only a revision draft can be finalized as a revision.');
    }
    const content = cloneQuoteData(existing.workingDraft.content);
    const contentHash = await hashQuoteContent(content, cryptoProvider);
    const database = await openDatabase();
    const timestamp = now();
    const versionId = idFactory();
    const transaction = database.transaction([
      QUOTE_LIBRARY_STORES.quotes,
      QUOTE_LIBRARY_STORES.quoteVersions,
      QUOTE_LIBRARY_STORES.quoteEvents
    ], 'readwrite');
    const quotes = transaction.objectStore(QUOTE_LIBRARY_STORES.quotes);
    const versions = transaction.objectStore(QUOTE_LIBRARY_STORES.quoteVersions);
    const current = await quotes.get(quoteId);
    if (!current?.workingDraft || current.workingDraft.kind !== 'revision') {
      throw new Error('The revision draft changed before it could be finalized.');
    }
    if (canonicalJson(current.workingDraft.content) !== canonicalJson(content)) {
      throw new Error('The revision draft changed before it could be finalized. Save and try again.');
    }
    const existingVersions = await versions.index('quoteId').getAll(quoteId);
    const revisionNumber = Math.max(...existingVersions.map((version) => version.revisionNumber), 0) + 1;
    const version = {
      id: versionId,
      schemaVersion: QUOTE_RECORD_SCHEMA_VERSION,
      quoteId,
      baseNumber: current.baseNumber,
      revisionNumber,
      displayNumber: buildDisplayNumber(current.baseNumber, revisionNumber),
      basedOnVersionId: current.workingDraft.basedOnVersionId,
      content,
      calculationPolicyVersion: 'legacy-markup-v1',
      pdfTemplateVersion: 'vision-quotation-v1',
      contentHash,
      finalizedAt: timestamp,
      createdAt: timestamp
    };
    current.currentStatus = 'finalized';
    current.latestVersionId = versionId;
    current.versionIds = [...current.versionIds, versionId];
    delete current.workingDraft;
    current.customerSearchText = createQuoteSearchText(content, current.baseNumber);
    current.updatedAt = timestamp;
    await versions.add(version);
    await quotes.put(current);
    await transaction.objectStore(QUOTE_LIBRARY_STORES.quoteEvents).add(eventRecord({
      idFactory,
      now,
      quoteId,
      quoteVersionId: versionId,
      type: 'finalized'
    }));
    await transaction.done;
    return cloneQuoteData(version);
  }

  async function duplicateAsNew(sourceQuoteId, { versionId, quoteDate } = {}) {
    const sourceQuote = await getQuote(sourceQuoteId);
    if (!sourceQuote) throw new Error('The source quote was not found.');
    let sourceVersionId = versionId;
    let content;
    if (sourceVersionId) {
      const version = await getVersion(sourceVersionId);
      if (!version || version.quoteId !== sourceQuoteId) throw new Error('The selected source version was not found.');
      content = version.content;
    } else if (sourceQuote.workingDraft) {
      content = sourceQuote.workingDraft.content;
    } else if (sourceQuote.latestVersionId) {
      sourceVersionId = sourceQuote.latestVersionId;
      const version = await getVersion(sourceVersionId);
      if (!version) throw new Error('The latest source version is unavailable.');
      content = version.content;
    } else {
      throw new Error('The source quote has no content to duplicate.');
    }
    content = cloneQuoteData(content);
    if (quoteDate) {
      content.quoteDate = String(quoteDate);
      content.expirationDate = '';
    }
    return createDraft(content, {
      sourceQuoteId,
      sourceQuoteVersionId: sourceVersionId,
      customerId: sourceQuote.customerId,
      contactId: sourceQuote.contactId
    });
  }

  async function listEvents(quoteId) {
    const database = await openDatabase();
    const records = await database.getAllFromIndex(QUOTE_LIBRARY_STORES.quoteEvents, 'quoteId', quoteId);
    return records.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt)).map(cloneQuoteData);
  }

  async function getRecoveryRecords() {
    const database = await openDatabase();
    const records = await database.getAll(QUOTE_LIBRARY_STORES.recoveryRecords);
    return records.sort((left, right) => right.detectedAt.localeCompare(left.detectedAt)).map(cloneQuoteData);
  }

  async function close() {
    if (!databasePromise) return;
    const database = await databasePromise;
    database.close();
    databasePromise = undefined;
  }

  async function destroy() {
    await close();
    await deleteDB(databaseName);
  }

  return {
    initialize: ensureSettings,
    getSettings: ensureSettings,
    createDraft,
    createDraftFromLegacyQuote,
    getQuote,
    saveDraftContent,
    saveDraftWithCustomer,
    saveCustomerAndContact,
    getCustomer,
    getContact,
    listContacts,
    searchCustomers,
    searchQuotes,
    finalizeBase,
    getVersion,
    listVersions,
    startRevision,
    finalizeRevision,
    duplicateAsNew,
    listEvents,
    getRecoveryRecords,
    close,
    destroy
  };
}
