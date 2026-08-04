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

/**
 * Binds the preview-only restore inspection controls.
 *
 * inspectionService.inspectBackupFile(file, { onProgress }) must return only
 * validated metadata: { filename, formattedSize, schemaVersion, exportedAt,
 * recordCounts, incoming, current, comparison, restorePlan }. Comparison
 * values are aggregate-only: counts and future merge availability. It must not
 * write to IndexedDB or localStorage.
 */
export function initializeBackupRestoreInspectionUi({ inspectionService }) {
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
  let busy = false;

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

  function updateSelection() {
    resetReport();
    inspectButton.disabled = !fileInput.files?.length;
    if (fileInput.files?.length) {
      setStatus(status, 'Ready to inspect the selected backup. Inspection does not change this device.');
    } else {
      setStatus(status, 'Choose a JSON backup file to inspect it before any future restore option.');
    }
  }

  async function inspect() {
    if (busy || !fileInput.files?.length) return;
    const [file] = fileInput.files;
    busy = true;
    inspectButton.disabled = true;
    workspace.setAttribute('aria-busy', 'true');
    resetReport();
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
      mergeAvailability.textContent = hasBlockingConflicts ? 'Blocked by future-restore conflicts' : 'Not available in this preview-only step';
      if (hasBlockingConflicts) {
        conflictWarning.textContent = 'This preview found blocking conflicts. A future Merge action would remain unavailable until those conflicts are resolved.';
        conflictWarning.hidden = false;
      }
      report.hidden = false;
      setStatus(status, 'Backup inspection passed. Review this preview; Merge and Replace are not available yet.');
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
    }
  }

  fileInput.addEventListener('change', updateSelection);
  inspectButton.addEventListener('click', inspect);
  updateSelection();

  return { inspect, resetReport };
}
