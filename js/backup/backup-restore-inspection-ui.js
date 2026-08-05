import { triggerBlobDownload } from '../services/backup-download-service.js';

function safeText(value, fallback = 'Not available') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function safeCount(value) {
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? String(count) : '0';
}

function safeSchemaVersion(value) {
  return typeof value === 'string' || Number.isSafeInteger(value)
    ? safeText(String(value), 'Unknown')
    : 'Unknown';
}

function setStatus(status, message, isError = false) {
  status.textContent = message;
  status.classList.toggle('is-error', isError);
}

function selectedRestoreMode(merge, replace) {
  return replace.checked ? 'replace' : merge.checked ? 'merge' : '';
}

function restoreProgressMessage(stage) {
  const messages = {
    reading: 'Reading the selected backup locally. Nothing has changed.',
    validating: 'Validating the selected backup. Nothing has changed.',
    revalidating: 'Validating the selected backup again before restore. Nothing has changed.',
    'safety-backup': 'Preparing a complete safety backup of this device before restore.',
    staging: 'Staging the scoped browser data for a safe local restore. Keep this page open.',
    writing: 'Restoring this device in one local transaction. Keep this page open.',
    verifying: 'Validating the restored device data. Keep this page open.'
  };
  return messages[stage] || 'Preparing the local restore. Keep this page open.';
}

/**
 * Binds the Version 2.5 owner-confirmed restore controls.
 *
 * The inspection service returns sanitized aggregate metadata only. The restore
 * service owns all parsing, revalidation, safety-backup download, transactional
 * writes, rollback, and post-restore validation. This DOM adapter deliberately
 * never reads or renders record contents, customer data, pricing, or IDs.
 */
export function initializeBackupRestoreInspectionUi({
  inspectionService,
  restoreService = null,
  reloadPage = () => globalThis.location?.reload()
}) {
  if (!inspectionService?.inspectBackupFile) {
    throw new Error('A backup inspection service is required.');
  }

  const workspace = document.getElementById('exportWorkspace');
  const fileInput = document.getElementById('backupRestoreFile');
  const inspectButton = document.getElementById('inspectBackup');
  const status = document.getElementById('backupInspectionStatus');
  const report = document.getElementById('backupInspectionReport');
  const filename = document.getElementById('backupInspectionFilename');
  const fileSize = document.getElementById('backupInspectionFileSize');
  const schemaVersion = document.getElementById('backupInspectionSchemaVersion');
  const exportedAt = document.getElementById('backupInspectionExportedAt');
  const recordCounts = document.getElementById('backupInspectionRecordCounts');
  const incomingTotal = document.getElementById('backupInspectionIncomingTotal');
  const currentTotal = document.getElementById('backupInspectionCurrentTotal');
  const localStorageDifferences = document.getElementById('backupInspectionLocalStorageDifferences');
  const mutableDifferences = document.getElementById('backupInspectionMutableDifferences');
  const immutableConflicts = document.getElementById('backupInspectionImmutableConflicts');
  const numberCollisions = document.getElementById('backupInspectionNumberCollisions');
  const mergeAvailability = document.getElementById('backupInspectionMergeAvailability');
  const conflictWarning = document.getElementById('backupInspectionConflictWarning');
  const restoreAction = document.getElementById('backupRestoreAction');
  const mergeMode = document.getElementById('restoreModeMerge');
  const replaceMode = document.getElementById('restoreModeReplace');
  const modeWarning = document.getElementById('backupRestoreModeWarning');
  const confirmation = document.getElementById('backupRestoreConfirmation');
  const restoreButton = document.getElementById('restoreBackup');
  const restoreStatus = document.getElementById('backupRestoreStatus');
  const restoreResult = document.getElementById('backupRestoreResult');
  const safetyFilename = document.getElementById('backupRestoreSafetyFilename');
  const resultMode = document.getElementById('backupRestoreResultMode');
  const recordSummary = document.getElementById('backupRestoreRecordSummary');
  let busy = false;
  let latestInspection = null;
  let restoreCommitted = false;

  function lockStaleApplicationAndReload() {
    restoreCommitted = true;
    document.querySelector('.app-header')?.setAttribute('inert', '');
    document.querySelector('.app-navigation')?.setAttribute('inert', '');
    document.querySelector('.app-views')?.setAttribute('inert', '');
    window.setTimeout(() => reloadPage(), 1200);
  }

  function resetReport() {
    report.hidden = true;
    filename.textContent = '';
    fileSize.textContent = '';
    schemaVersion.textContent = '';
    exportedAt.textContent = '';
    recordCounts.textContent = '';
    incomingTotal.textContent = '';
    currentTotal.textContent = '';
    localStorageDifferences.textContent = '';
    mutableDifferences.textContent = '';
    immutableConflicts.textContent = '';
    numberCollisions.textContent = '';
    mergeAvailability.textContent = '';
    conflictWarning.textContent = '';
    conflictWarning.hidden = true;
  }

  function resetRestoreAction() {
    latestInspection = null;
    restoreAction.hidden = true;
    mergeMode.disabled = false;
    replaceMode.disabled = false;
    mergeMode.checked = true;
    confirmation.value = '';
    modeWarning.textContent = '';
    modeWarning.hidden = true;
    restoreButton.disabled = true;
    restoreStatus.textContent = '';
    restoreStatus.classList.remove('is-error');
    restoreResult.hidden = true;
    safetyFilename.textContent = '';
    resultMode.textContent = '';
    recordSummary.textContent = '';
  }

  function isBlocked(inspection) {
    const mergePlan = inspection?.restorePlan?.merge || {};
    return mergePlan.blocked === true || Number(inspection?.comparison?.blockingConflictCount) > 0;
  }

  function updateRestoreButton() {
    const confirmationAccepted = confirmation.value.trim() === 'RESTORE';
    const hasMode = Boolean(selectedRestoreMode(mergeMode, replaceMode));
    const canRestore = Boolean(latestInspection && restoreService?.restoreBackupFile && !isBlocked(latestInspection));
    restoreButton.disabled = restoreCommitted || busy || !confirmationAccepted || !hasMode || !canRestore;
  }

  function renderRestoreEligibility(inspection) {
    const blocked = isBlocked(inspection);
    restoreAction.hidden = false;
    mergeMode.disabled = blocked;
    replaceMode.disabled = blocked;

    if (blocked) {
      modeWarning.textContent = 'Restore is unavailable for this backup because its immutable conflicts or quote-number collisions require review. Nothing was changed.';
      modeWarning.hidden = false;
      setStatus(restoreStatus, 'Restore remains unavailable for this inspected backup. Choose another backup or resolve the conflicts first.', true);
    } else if (!restoreService?.restoreBackupFile) {
      modeWarning.textContent = 'Restore is unavailable because this browser could not initialize the local restore service. Nothing was changed.';
      modeWarning.hidden = false;
      setStatus(restoreStatus, 'Restore is unavailable. Keep this page open and reload before trying again.', true);
    } else {
      modeWarning.hidden = true;
      setStatus(restoreStatus, 'Choose Merge or Replace, then type RESTORE to enable the final confirmation button.');
    }
    updateRestoreButton();
  }

  function updateSelection() {
    resetReport();
    resetRestoreAction();
    inspectButton.disabled = !fileInput.files?.length;
    if (fileInput.files?.length) {
      setStatus(status, 'Ready to inspect the selected backup. Inspection does not change this device.');
    } else {
      setStatus(status, 'Choose a JSON backup to inspect before any restore option is available.');
    }
  }

  async function inspect() {
    if (busy || !fileInput.files?.length) return;
    const [file] = fileInput.files;
    busy = true;
    inspectButton.disabled = true;
    workspace.setAttribute('aria-busy', 'true');
    resetReport();
    resetRestoreAction();
    setStatus(status, 'Inspecting the selected backup locally. No data is being changed.');

    try {
      const inspection = await inspectionService.inspectBackupFile(file, {
        onProgress: (stage) => {
          if (stage === 'reading') setStatus(status, 'Reading the selected backup locally. No data is being changed.');
          if (stage === 'validating') setStatus(status, 'Validating the selected backup. No data is being changed.');
        }
      });
      const counts = inspection.recordCounts || {};
      const comparison = inspection.comparison || {};
      const restorePlan = inspection.restorePlan || {};
      const mergePlan = restorePlan.merge || {};
      const blockingConflicts = safeCount(mergePlan.immutableConflicts);
      const blockingConflictTotal = safeCount(comparison.blockingConflictCount);
      const hasBlockingConflicts = mergePlan.blocked === true || blockingConflictTotal !== '0';
      filename.textContent = safeText(inspection.filename, safeText(file.name, 'Selected backup'));
      fileSize.textContent = safeText(inspection.formattedSize, 'Unknown size');
      schemaVersion.textContent = safeSchemaVersion(inspection.schemaVersion);
      exportedAt.textContent = safeText(inspection.exportedAt, 'Unknown');
      recordCounts.textContent = [
        `${safeCount(counts.quotes)} quotes`,
        `${safeCount(counts.finalizedVersions)} finalized versions`,
        `${safeCount(counts.customers)} customers`,
        `${safeCount(counts.catalogItems)} catalog items`,
        `${safeCount(counts.manualItems)} manual items`
      ].join(' | ');
      incomingTotal.textContent = safeCount(inspection.incoming?.recordCount);
      currentTotal.textContent = safeCount(inspection.current?.recordCount);
      localStorageDifferences.textContent = safeCount(comparison.localStorage?.different);
      mutableDifferences.textContent = safeCount(comparison.mutableDifferences);
      immutableConflicts.textContent = blockingConflicts;
      numberCollisions.textContent = safeCount(mergePlan.numberCollisions);
      mergeAvailability.textContent = hasBlockingConflicts ? 'Blocked by restore conflicts' : 'Available after owner confirmation';
      if (hasBlockingConflicts) {
        conflictWarning.textContent = 'This preview found blocking conflicts. Restore is unavailable until the conflicts are resolved.';
        conflictWarning.hidden = false;
      }
      latestInspection = inspection;
      report.hidden = false;
      renderRestoreEligibility(inspection);
      setStatus(status, 'Backup inspection passed. Review the restore choices below before making any change.');
    } catch (error) {
      if (error?.code === 'file-too-large') {
        setStatus(status, 'This backup is over the 25 MiB inspection limit. Nothing was changed on this device. Choose a smaller complete JSON backup and try again.', true);
      } else {
        setStatus(status, 'This backup could not be inspected. Nothing was changed on this device. Choose a complete JSON backup and try again.', true);
      }
    } finally {
      busy = false;
      inspectButton.disabled = !fileInput.files?.length;
      workspace.removeAttribute('aria-busy');
      updateRestoreButton();
    }
  }

  function renderRestoreResult(result, mode) {
    const safetyBackup = result?.safetyBackup || {};
    const summary = result?.restoreSummary || result?.summary || {};
    safetyFilename.textContent = safeText(safetyBackup.filename, 'Safety backup download requested');
    resultMode.textContent = mode === 'replace' ? 'Replace this device' : 'Merge';
    recordSummary.textContent = safeText(
      summary.message,
      `${safeCount(summary.created)} added | ${safeCount(summary.replaced)} replaced | ${safeCount(summary.keptCurrent)} kept current | ${safeCount(summary.identical)} unchanged`
    );
    restoreResult.hidden = false;
  }

  async function restore() {
    if (busy || restoreButton.disabled || !fileInput.files?.length || !latestInspection) return;
    const mode = selectedRestoreMode(mergeMode, replaceMode);
    const [file] = fileInput.files;
    busy = true;
    inspectButton.disabled = true;
    restoreButton.disabled = true;
    workspace.setAttribute('aria-busy', 'true');
    restoreResult.hidden = true;
    setStatus(restoreStatus, 'Validating the selected backup again before restore. Nothing has changed.');

    try {
      const result = await restoreService.restoreBackupFile(file, {
        mode,
        confirmation: confirmation.value.trim(),
        onProgress: (stage) => setStatus(restoreStatus, restoreProgressMessage(stage)),
        onSafetyBackupDownload: (safetyBackup) => {
          const requestedFilename = safeText(safetyBackup?.filename, 'safety backup');
          triggerBlobDownload({ blob: safetyBackup?.blob, filename: requestedFilename });
          safetyFilename.textContent = requestedFilename;
          setStatus(restoreStatus, `Safety-backup download requested: ${requestedFilename}. The local restore can now continue.`);
        }
      });
      renderRestoreResult(result, mode);
      setStatus(restoreStatus, `Restore completed and was validated. Keep the safety backup download: ${safeText(result?.safetyBackup?.filename, 'check your browser downloads')}. Reloading this device's fresh saved data now.`);
      confirmation.value = '';
      lockStaleApplicationAndReload();
    } catch (error) {
      if (error?.code === 'restore-conflict' || error?.code === 'immutable-conflict') {
        setStatus(restoreStatus, 'Restore stopped because the selected backup now conflicts with this device. Nothing was changed.', true);
      } else if (error?.code === 'safety-backup-download-failed' || error?.code === 'safety-backup-failed') {
        setStatus(restoreStatus, 'Restore did not begin because the safety-backup download could not be requested. Nothing was changed.', true);
      } else if (error?.code === 'post-restore-validation-failed' || error?.code === 'post-restore-mismatch') {
        setStatus(restoreStatus, 'Restore did not complete validation. The service preserved or restored the prior device data; keep this page open and retry only after review.', true);
      } else {
        setStatus(restoreStatus, 'Restore could not be completed. Existing device data was preserved or rolled back. Keep this page open and try again after reviewing the backup.', true);
      }
    } finally {
      busy = false;
      inspectButton.disabled = !fileInput.files?.length;
      workspace.removeAttribute('aria-busy');
      updateRestoreButton();
    }
  }

  fileInput.addEventListener('change', updateSelection);
  inspectButton.addEventListener('click', inspect);
  [mergeMode, replaceMode].forEach((mode) => mode.addEventListener('change', updateRestoreButton));
  confirmation.addEventListener('input', updateRestoreButton);
  restoreButton.addEventListener('click', restore);
  updateSelection();

  return { inspect, restore, resetReport };
}
