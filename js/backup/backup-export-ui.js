import { BackupValidationError } from '../services/backup-download-service.js';

function countLabel(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function initializeBackupExportUi({ downloadService }) {
  const workspace = document.getElementById('exportWorkspace');
  const downloadButton = document.getElementById('downloadCompleteBackup');
  const status = document.getElementById('backupStatus');
  const result = document.getElementById('backupResult');
  const filename = document.getElementById('backupFilename');
  const fileSize = document.getElementById('backupFileSize');
  const recordCounts = document.getElementById('backupRecordCounts');
  let busy = false;

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  }

  function setProgress(stage) {
    const messages = {
      preparing: 'Preparing a complete backup from saved data on this device...',
      validating: 'Validating the backup before download...',
      downloading: 'Starting the local JSON download...',
      complete: 'Backup prepared. Check your browser downloads.'
    };
    setStatus(messages[stage] || 'Preparing backup...');
  }

  async function download() {
    if (busy) return;
    busy = true;
    downloadButton.disabled = true;
    workspace.setAttribute('aria-busy', 'true');
    result.hidden = true;

    try {
      const downloaded = await downloadService.downloadCompleteBackup({ onProgress: setProgress });
      filename.textContent = downloaded.filename;
      fileSize.textContent = `${downloaded.formattedSize} (${downloaded.byteCount} bytes)`;
      recordCounts.textContent = [
        countLabel(downloaded.counts.quotes, 'quote'),
        countLabel(downloaded.counts.finalizedVersions, 'finalized version'),
        countLabel(downloaded.counts.customers, 'customer'),
        countLabel(downloaded.counts.recoveryRecords, 'recovery record')
      ].join(' · ');
      result.hidden = false;
      setStatus(`Download requested: ${downloaded.filename}. Check your browser downloads and store this unencrypted file securely.`);
    } catch (error) {
      if (error instanceof BackupValidationError) {
        setStatus('Backup validation failed. Nothing was downloaded or changed. Keep this page open and try again.', true);
      } else {
        setStatus('The complete backup could not be prepared or downloaded. Nothing was changed. Keep this page open and try again.', true);
      }
    } finally {
      busy = false;
      downloadButton.disabled = false;
      workspace.removeAttribute('aria-busy');
    }
  }

  downloadButton.addEventListener('click', download);

  return { download };
}
