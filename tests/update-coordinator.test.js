import { describe, expect, it, vi } from 'vitest';
import {
  RESTORE_IN_PROGRESS_MESSAGE,
  UNSAVED_CHANGES_MESSAGE,
  UPDATE_READY_MESSAGE,
  initializeUpdateCoordinator
} from '../js/pwa/update-coordinator.js';

function eventSource() {
  const listeners = new Map();
  return {
    addEventListener: vi.fn((name, listener) => listeners.set(name, listener)),
    emit(name) {
      listeners.get(name)?.();
    }
  };
}

function button() {
  const source = eventSource();
  return {
    ...source,
    disabled: false,
    click() { source.emit('click'); }
  };
}

function setup({ waiting = true, dirty = false, restoring = false } = {}) {
  const worker = { postMessage: vi.fn(), state: 'installed' };
  const registration = { ...eventSource(), waiting: waiting ? worker : null, installing: null };
  const serviceWorker = { ...eventSource(), controller: {} };
  const applyButton = button();
  const laterButton = button();
  const notice = { hidden: true };
  const status = { textContent: '' };
  const confirmReload = vi.fn(() => true);
  const reloadPage = vi.fn();
  const coordinator = initializeUpdateCoordinator({
    registrationPromise: Promise.resolve({ registered: true, registration }),
    notice,
    status,
    applyButton,
    laterButton,
    navigatorReference: { serviceWorker },
    hasUnsavedChanges: () => dirty,
    isRestoreInProgress: () => restoring,
    confirmReload,
    reloadPage
  });
  return { worker, registration, serviceWorker, applyButton, laterButton, notice, status, confirmReload, reloadPage, coordinator };
}

describe('safe service-worker update coordinator', () => {
  it('shows a waiting update but never activates it by itself', async () => {
    const state = setup();
    await state.coordinator.ready;

    expect(state.notice.hidden).toBe(false);
    expect(state.status.textContent).toBe(UPDATE_READY_MESSAGE);
    expect(state.worker.postMessage).not.toHaveBeenCalled();
  });

  it('waits for explicit confirmation before discarding unsaved quote edits', async () => {
    const state = setup({ dirty: true });
    state.confirmReload.mockReturnValue(false);
    await state.coordinator.ready;

    state.applyButton.click();

    expect(state.confirmReload).toHaveBeenCalledWith(UNSAVED_CHANGES_MESSAGE);
    expect(state.worker.postMessage).not.toHaveBeenCalled();
    expect(state.status.textContent).toContain('Save your quote');
  });

  it('blocks an update while a local restore is active', async () => {
    const state = setup({ restoring: true });
    await state.coordinator.ready;

    state.applyButton.click();

    expect(state.worker.postMessage).not.toHaveBeenCalled();
    expect(state.status.textContent).toBe(RESTORE_IN_PROGRESS_MESSAGE);
  });

  it('requests skip-waiting only after a safe choice, then reloads on controller change', async () => {
    const state = setup({ dirty: true });
    await state.coordinator.ready;

    state.applyButton.click();
    expect(state.worker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(state.applyButton.disabled).toBe(true);

    state.serviceWorker.emit('controllerchange');
    state.serviceWorker.emit('controllerchange');
    expect(state.reloadPage).toHaveBeenCalledOnce();
  });

  it('hides a deferred update for the current page without losing the waiting worker', async () => {
    const state = setup();
    await state.coordinator.ready;

    state.laterButton.click();
    expect(state.notice.hidden).toBe(true);
    expect(state.worker.postMessage).not.toHaveBeenCalled();
  });

  it('shows a later update after an earlier update was deferred', async () => {
    const state = setup();
    await state.coordinator.ready;
    state.laterButton.click();

    const nextWorker = { ...eventSource(), state: 'installed', postMessage: vi.fn() };
    state.registration.waiting = nextWorker;
    state.registration.installing = nextWorker;
    state.registration.emit('updatefound');
    nextWorker.emit('statechange');

    expect(state.notice.hidden).toBe(false);
  });
});
