export function getConnectivityState(navigatorReference = globalThis.navigator) {
  return navigatorReference?.onLine === false ? 'offline' : 'online';
}

export function connectivityMessage(state) {
  return state === 'offline'
    ? 'Offline · saved quotes, catalog, and calculator remain available on this device. Email apps may need a connection to send.'
    : 'Online · quote data stays on this device.';
}

export function initializeConnectivityStatus({
  element,
  navigatorReference = globalThis.navigator,
  windowReference = globalThis.window
} = {}) {
  if (!element) return () => {};

  const render = () => {
    const state = getConnectivityState(navigatorReference);
    element.dataset.connection = state;
    element.textContent = connectivityMessage(state);
  };

  render();
  windowReference?.addEventListener?.('online', render);
  windowReference?.addEventListener?.('offline', render);
  return () => {
    windowReference?.removeEventListener?.('online', render);
    windowReference?.removeEventListener?.('offline', render);
  };
}
