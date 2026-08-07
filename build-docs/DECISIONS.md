# Decisions

## Version 3.0 Public Bootstrap-Cache Boundary

**DECISION:** The second Version 3 slice may register a classic `/gtm-calc/sw.js` worker with `updateViaCache: 'none'`, precache only a small public bootstrap set, and delete only retired `gtm-calc-app-shell-*` caches. It has no `fetch` listener and must not read, write, cache, or migrate IndexedDB/localStorage, quote/customer/catalog records, generated PDFs, backup files, mailto URLs, or external resources.
**RATIONALE:** Registration and cache ownership can be verified before offline routing changes. A no-fetch worker leaves normal online behavior untouched and prevents cached business data or output from becoming a hidden recovery surface.
**DATE:** 2026-08-07
**PARTIES:** Will Z, Goodall program review, Codex

## Version 3.0 Install-Metadata Boundary

**DECISION:** The first Version 3 runtime slice adds a root `manifest.webmanifest`, `/gtm-calc/` ID/start/scope, standalone display metadata, branded square and maskable icons derived from the approved Vision artwork, and Android/iPhone installation guidance. It must keep service-worker registrations at zero and make no offline claim.
**RATIONALE:** Install metadata can be verified independently from caching. Separating it from the service worker prevents an icon/manifest PR from silently changing network behavior or introducing stale-code and local-data risks.
**DATE:** 2026-08-06
**PARTIES:** Will Z, Goodall program review, Codex

## Version 3.0 Staged PWA Boundary

**DECISION:** Begin Version 3.0 with a documentation-first, reviewable PR sequence: manifest/install metadata, service-worker cache policy, offline local-data readiness, safe update activation, then production closeout. Do not add a service worker, manifest, or cache files until the corresponding implementation PR is reviewed against `docs/V3_IMPLEMENTATION_PLAN.md`.
**RATIONALE:** Version 2.5 is now tagged and provides recovery evidence, but PWA caching can create stale-code and data-loss risks. Separating metadata, caching, offline behavior, update UX, and release evidence keeps rollback and privacy boundaries testable.
**DATE:** 2026-08-06
**PARTIES:** Will Z, Goodall program review, Codex

## Version 2.5 Stable Release Published

**DECISION:** Publish annotated tag `v2.5.0` at verified production commit `7ab4d2e` after PR #29 merged, Pages deployment `31128724445` passed, and the live marker was confirmed. Treat Version 2.5 as closed and Version 3.0 PWA planning as active.
**RATIONALE:** The release checklist now has automated, physical-device, owner, post-merge, and tag evidence. A fixed annotated tag gives future PWA work a stable recovery boundary without changing local data.
**DATE:** 2026-08-06
**PARTIES:** Will Z, Goodall program review, Codex

## Version 2.5 Acceptance and Version 3.0 Planning Gate

**DECISION:** Accept Version 2.5 as complete after PR #28 merged as `0716350`, owner physical acceptance passed on Samsung Galaxy S24 Ultra/Chrome and Dell desktop/Chrome, post-merge Pages deployment `31128417026` passed, and local post-merge unit/build/production smoke checks passed. Advance the roadmap to active Version 3.0 planning. Publish the annotated `v2.5.0` tag at the verified production commit before implementing service-worker or cache changes.
**RATIONALE:** The complete backup/restore and export workflow now has automated, physical-device, owner, and production evidence. Keeping the stable tag as the remaining explicit release action preserves an auditable boundary before PWA caching can affect recovery behavior.
**DATE:** 2026-08-06
**PARTIES:** Will Z, Goodall program review, Codex

## Version 2.5 Local Backup Download Policy

**DECISION:** Place the complete backup in a fifth `Export` workspace, include only persisted data, revalidate the exact readable JSON before Blob creation, name it `gtm-calc-backup-YYYY-MM-DD.json` from the envelope's UTC export date, and report that download was started rather than claiming the browser saved it. Display a permanent warning that the unencrypted file contains customer/contact and internal pricing/profitability data.
**RATIONALE:** Export is a durable home for later CSV and individual-record downloads. Persisted-only capture preserves the accepted read-only storage contract, exact-byte validation prevents serialization drift, UTC naming is deterministic and customer-neutral, and conservative status wording reflects the browser API's inability to prove disk persistence.
**DATE:** 2026-08-04
**PARTIES:** Goodall program review, Codex, Will Z


## Version 2.5 Lossless Backup Boundary

**DECISION:** Define the authoritative JSON backup as a checksummed envelope containing an exact, consistently read snapshot of all eight `gtm_quote_manager` stores plus allowlisted serialized localStorage business/recovery entries. Exclude navigation/session signals, unrelated origin keys, generated PDFs, and CSV reports. Build and verify the read-only foundation before exposing download or restore writes.
**RATIONALE:** The prior domain sketch omitted recovery/migration metadata, the legacy active quote, the previous catalog, and usage data, so it could not truthfully support a complete restore. Exact scoped values preserve current and recovery data without coupling the format to UI projections; staged delivery prevents an unreviewed restore path from risking the accepted Version 2 library.
**DATE:** 2026-08-03
**PARTIES:** Codex, Will Z


## Version 2 Stable Acceptance

**DECISION:** Accept Version 2 as complete after PR #19 head `22cf299` merged as `3e41007`, CI run `30130612587` and Pages run `30132341911` passed, live production phone/laptop/privacy smoke passed, Android and owner-approved laptop Chromium acceptance passed, and rollback/re-entry preserved the legacy and IndexedDB inventories. Advance the roadmap to Version 2.5. Create `v2.0.0` only after the closeout deployment is verified.
**RATIONALE:** The automated, production, physical-device, privacy, and rollback gates now have exact evidence. Separating final tag creation from the acceptance decision ensures the tag identifies the verified closeout deployment.
**DATE:** 2026-07-27
**PARTIES:** Will Z, Codex

## Customer and Contact Matching

**DECISION:** Accept the implemented Version 2 behavior: deliberately selected customer/contact records use stable IDs; an unbound save reuses the first exact normalized company-name match; within that customer, an exact normalized email match is reused, or an exact normalized buyer-name match is reused when email is blank. Defer same-name company disambiguation and blank-email confirmation to a later approved slice.
**RATIONALE:** This records the production behavior the owner tested and accepted without claiming safeguards that Version 2 does not implement. Stable IDs preserve deliberate selection, while the ambiguity risk remains explicit rather than silently redefined during release closeout.
**DATE:** 2026-07-27
**PARTIES:** Will Z, Codex

## Duplicate Reset Behavior

**DECISION:** Duplicate-as-new resets the quote number, lifecycle status/events, quote date, and expiration. It retains customer/contact, line items/pricing, sales rep, shipping, terms, and notes, and remains visibly marked `DUP` until its first successful save.
**RATIONALE:** This preserves the useful source content while resetting lifecycle identity and requiring an explicit review before the duplicate loses its warning state.
**DATE:** 2026-07-27
**PARTIES:** Will Z, Codex

## Deletion and Archive Deferral

**DECISION:** Do not add quote deletion, archive, or abandoned-revision cleanup to Version 2. Address retention controls only in a separate approved roadmap slice.
**RATIONALE:** Destructive retention behavior needs its own recovery, backup, and owner-policy design and must not expand the stable Version 2 boundary.
**DATE:** 2026-07-27
**PARTIES:** Will Z, Codex

## Version 2 Release-Candidate Boundary

**DECISION:** Treat PR #19 as a non-deploying release candidate with marker `v2.0.0 · release-candidate.1`. It may close correctness risks and add release evidence, but it must not mark Version 2 complete or create the stable tag. Owner Android/laptop acceptance and a post-merge production smoke are recorded before a documentation-only closeout marks Version 2 complete and advances the roadmap to Version 2.5.
**RATIONALE:** Feature branches cannot deploy production, so the release-candidate PR cannot truthfully claim its own post-merge Pages verification. Separating candidate hardening from production closeout preserves the repository's evidence rules.
**DATE:** 2026-07-24
**PARTIES:** Codex; owner acceptance pending

## Version 2 Workspace Navigation

**DECISION:** Use four state-preserving workspaces—Quote, Library, Customers, and Catalog—with a fixed phone bottom bar and a sticky laptop navigation rail. Keep search and CSV import inside their relevant workspaces. Opening a quote, applying a customer, or selecting a catalog item returns to Quote.

The Version 2.5 Export addition uses the shorter visible label **Clients** for the existing customer-record workspace so five labels fit a 320 px phone viewport. The accessible name matches the visible label for voice-control compatibility; underlying customer terminology and data are unchanged.
**RATIONALE:** The prior one-document interface became difficult to scan once the quote library, customer recall, and catalog workflows grew. This improves wayfinding without adding routes, a framework, new storage, or an opportunity to discard unsaved quote state.
**DATE:** 2026-07-22
**PARTIES:** Codex, Will Z

## Navigation Replacement and Focus Safety

**DECISION:** Ask for confirmation only when selecting a catalog item or saved customer would replace non-empty, different values. Keep empty-form selection one tap. After record recall, move focus to a visible Quote target and announce the outcome.
**RATIONALE:** This prevents silent loss of partially entered data while preserving the fast common path. Explicit focus restoration avoids leaving keyboard and screen-reader users inside a hidden workspace.
**DATE:** 2026-07-23
**PARTIES:** Codex, Will Z

## Version 2 Quote Lifecycle Rules

**DECISION:** Allocate a base quote number from the calendar year in which finalization occurs. Allow Finalized → Sent or Cancelled; allow Sent → Accepted, Declined, Expired, or Cancelled; treat Accepted, Declined, Expired, and Cancelled as terminal. Start revisions only from the latest finalized version while retaining every prior version for read-only output and PDF regeneration.
**RATIONALE:** Finalization-time numbering makes allocation deterministic, the restricted status graph avoids silently reopening business outcomes, and latest-only revision starts keep history linear without sacrificing access to earlier immutable customer documents.
**DATE:** 2026-07-16
**PARTIES:** Codex, Will Z

## Version and Roadmap Documentation Synchronization

**DECISION:** Every application version or milestone-status change must include a roadmap-infographic and product-roadmap review. Every full or half product-version change must update README and all affected release, current-state, implementation, test, build-log, decision, and open-item documentation in the same pull request.
**RATIONALE:** Version labels, roadmap status, and release documentation had diverged. A repository-level rule and deterministic SVG roadmap keep the visible project story synchronized and make future status edits reliable.
**DATE:** 2026-07-16
**PARTIES:** Codex, Will Z

## Restore Inspection Boundary

**DECISION:** Version 2.5 PR 3 accepts a selected backup for inspection only when its declared size is at most 25 MiB. It reads UTF-8 strictly, validates the complete envelope before reading current-device state, and reports aggregate differences/conflicts without raw customer, contact, pricing, or record-identifier data. It exposes no merge, replace, repository-import, clear, or storage-write action.
**RATIONALE:** The guard is comfortably above the expected 250-quote-per-year device backup and capped catalog snapshots while avoiding unnecessary phone-memory pressure. A safe preview gives the owner evidence for a later restore decision without creating an accidental destructive path or exposing sensitive data in the interface.
**DATE:** 2026-08-04
**PARTIES:** Codex, Will Z (continued implementation authorization)

## Owner-Confirmed Restore Transaction Boundary

**DECISION:** Version 2.5 PR 4 exposes restore only after a successful local inspection. It revalidates the selected file at commit time, blocks immutable-version/event conflicts and finalized-number collisions, requires an explicit Merge or Replace selection plus the typed confirmation `RESTORE`, and requests a complete safety-backup download before any local write. Merge preserves current mutable conflicts; Replace substitutes the selected backup's scoped data. The user interface may show only aggregate counts, neutral filenames, and outcome summaries.
**RATIONALE:** Inspection-time validity cannot authorize a later destructive write because the file or current device may have changed. A pre-write safety backup, explicit destructive choice, single transaction/rollback, and no raw-data UI prevent accidental loss while keeping recovery entirely local and usable on a phone.
**DATE:** 2026-08-04
**PARTIES:** Goodall program review, Codex, Will Z (continued implementation authorization)

## Version 2.5 Stable-Tag Gate

**DECISION:** Treat PR6 as release hardening rather than a feature milestone. The annotated `v2.5.0` tag may be created only after automated evidence, physical Android Chrome and laptop Chromium acceptance, owner approval, post-merge Pages verification, and rollback instructions are recorded. The closeout branch uses `v2.5.0 · release-closeout.6` / `2.5.0-alpha.6` and does not alter application data or create a stable tag.
**RATIONALE:** PR5 is merged and operational, but local browser storage and restore behavior require device-level evidence before Version 3 cache/service-worker work can be allowed to complicate recovery. A visible closeout marker keeps the release state honest and makes the stable boundary auditable.
**DATE:** 2026-08-06
**PARTIES:** Goodall program review, Codex, Will Z (continued implementation authorization)

## Version 2.5 Reporting Export Boundary

**DECISION:** Keep CSV reports explicitly lossy and read-only. Serialize quote-list, customer, and manual-item projections with RFC 4180 quoting, CRLF line endings, deterministic local filenames, and formula-like cell neutralization. Export individual drafts from working content; finalized JSON/PDF output must resolve an explicitly selected immutable version, and customer PDFs continue through the existing privacy allowlist.
**RATIONALE:** Reports support local business workflows without creating a second backup format or exposing internal profitability in customer output. Explicit immutable-version selection preserves finalized history and prevents a later mutable draft from silently changing a historical export.
**DATE:** 2026-08-05
**PARTIES:** Goodall program review, Codex, Will Z (continued implementation authorization)

## Quote Library Progressive Disclosure and Duplicate Review State

**DECISION:** Show ten matching quote drafts initially and ten more per explicit request. Mark a newly duplicated draft with visible `DUP` text and pale shading while `sourceQuoteId` exists and `draftRevision` is zero; remove the marker after its first successful save without modifying the customer/company name.
**RATIONALE:** Fifty local quotes are not a storage concern, but rendering every card creates excessive phone scrolling. Existing lineage and revision data provides the temporary review state without a schema migration or risk of leaking `DUP` into PDFs, emails, customer records, or search.
**DATE:** 2026-07-16
**PARTIES:** Codex, Will Z

## Version 2 Foundation Boundary

**DECISION:** Introduce a separate `gtm_quote_manager` IndexedDB database behind a repository adapter while leaving `gtm_quote_calculator_v1` as the active visible quote. Use pinned `idb` for transaction handling and test with both `fake-indexeddb` and real browser IndexedDB. Require an explicit business year for number allocation until the owner approves the date/year rule.
**RATIONALE:** This proves migration, transaction, immutability, revision, duplicate, and recovery rules without making an irreversible UI/data cutover. The active Version 1.5 workflow remains the rollback path.
**DATE:** 2026-07-16
**PARTIES:** Codex, Will Z (continued implementation authorization)

## Version 1.5 Catalog Storage Boundary

**DECISION:** Keep `gtm_quote_calculator_v1` unchanged. Store Version 1.5 catalog, manual-item, and recent-use data behind separate versioned localStorage adapter keys with validation, one prior-import rollback copy, and recoverable failure states. Keep the adapter API migratable to IndexedDB in Version 2.
**RATIONALE:** This connects catalog search with minimal disruption to the stable Version 1 quote workflow while avoiding a premature quote-repository migration. Imports that exceed safe browser storage must fail visibly and preserve the previous catalog.
**DATE:** 2026-07-15
**PARTIES:** Codex, Will Z (continued implementation authorization)

## Memory Layer Added

**DECISION:** Track project memory in `BUILD-LOG.md`, `build-docs/DECISIONS.md`, and `build-docs/OPEN_ITEMS.md`.
**RATIONALE:** Keep session context durable, separable, and easy to resume without rereading the whole repository.
**DATE:** 2026-07-15
**PARTIES:** Codex, Will Z
