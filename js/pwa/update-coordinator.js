export const UPDATE_READY_MESSAGE = 'An update is ready. Save any changes, then reload when you are ready.';
export const RESTORE_IN_PROGRESS_MESSAGE = 'A backup restore is in progress. Finish it before applying the update.';
export const UNSAVED_CHANGES_MESSAGE = 'This update is ready. Save your quote before reloading, or confirm that you want to reload without saving.';

function setNoticeVisible(notice, visible) {
  if (notice) notice.hidden = !visible;
}

function setStatus(status, message) {
  if (status) status.textContent = message;
}

function workerIsInstalled(worker) {
  return worker?.state === 'installed';
}

/**
 * Presents an already-installed service-worker update without activating it.
 * The active page remains under the current worker until the user explicitly
 * requests an update; that request is guarded against local quote and restore
 * work that has not finished yet.
 */
export function initializeUpdateCoordinator({
  registrationPromise,
  notice,
  status,
  applyButton,
  laterButton,
  navigatorReference = globalThis.navigator,
  hasUnsavedChanges = () => false,
  isRestoreInProgress = () => false,
  confirmReload = (message) => globalThis.confirm?.(message) ?? false,
  reloadPage = () => globalThis.location?.reload()
} = {}) {
  let waitingWorker = null;
  let dismissed = false;
  let reloadRequested = false;
  let registration;

  const renderWaitingUpdate = (worker) => {
    if (!worker || dismissed) return;
    waitingWorker = worker;
    setNoticeVisible(notice, true);
    setStatus(status, UPDATE_READY_MESSAGE);
    if (applyButton) applyButton.disabled = false;
  };

  const inspectInstallingWorker = () => {
    const installing = registration?.installing;
    if (!installing?.addEventListener) return;
    installing.addEventListener('statechange', () => {
      if (workerIsInstalled(installing) && (registration.waiting || navigatorReference?.serviceWorker?.controller)) {
        renderWaitingUpdate(registration.waiting || installing);
      }
    });
  };

  const inspectRegistration = (nextRegistration) => {
    registration = nextRegistration;
    if (!registration) return;
    if (registration.waiting) renderWaitingUpdate(registration.waiting);
    registration.addEventListener?.('updatefound', () => {
      dismissed = false;
      inspectInstallingWorker();
    });
    inspectInstallingWorker();
  };

  const applyUpdate = () => {
    if (!waitingWorker) return;
    if (isRestoreInProgress()) {
      setNoticeVisible(notice, true);
      setStatus(status, RESTORE_IN_PROGRESS_MESSAGE);
      return;
    }
    if (hasUnsavedChanges() && !confirmReload(UNSAVED_CHANGES_MESSAGE)) {
      setNoticeVisible(notice, true);
      setStatus(status, 'Update left ready. Save your quote, then choose Reload update.');
      return;
    }

    reloadRequested = true;
    if (applyButton) applyButton.disabled = true;
    setStatus(status, 'Applying the update…');
    waitingWorker.postMessage?.({ type: 'SKIP_WAITING' });
  };

  const dismissUpdate = () => {
    dismissed = true;
    setNoticeVisible(notice, false);
  };

  applyButton?.addEventListener?.('click', applyUpdate);
  laterButton?.addEventListener?.('click', dismissUpdate);
  navigatorReference?.serviceWorker?.addEventListener?.('controllerchange', () => {
    if (!reloadRequested) return;
    reloadRequested = false;
    reloadPage();
  });

  const ready = Promise.resolve(registrationPromise)
    .then((result) => {
      if (result?.registered) inspectRegistration(result.registration);
    })
    .catch(() => {
      // Registration already reports failures as non-fatal normal online use.
    });

  return { applyUpdate, dismissUpdate, inspectRegistration, ready };
}
