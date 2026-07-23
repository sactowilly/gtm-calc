const VIEW_NAMES = Object.freeze(['quote', 'quotes', 'customers', 'catalog']);

function normalizeView(view) {
  return VIEW_NAMES.includes(view) ? view : 'quote';
}

/**
 * Keeps the phone-first workspaces in one document without unmounting any
 * existing form or library state. The API deliberately has no persistence:
 * reopening the app always starts at the active Quote workspace.
 */
export function initializeAppNavigation({ initialView = 'quote' } = {}) {
  const navigation = document.getElementById('appNavigation');
  const buttons = Array.from(navigation?.querySelectorAll('[data-app-view]') || []);
  const panels = Array.from(document.querySelectorAll('[data-app-view-panel]'));
  let currentView = normalizeView(initialView);

  function panelFor(view) {
    return panels.find((panel) => panel.dataset.appViewPanel === view);
  }

  function buttonFor(view) {
    return buttons.find((button) => button.dataset.appView === view);
  }

  function showView(view, { focus = false, scroll = true } = {}) {
    currentView = normalizeView(view);
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.appViewPanel !== currentView;
    });
    buttons.forEach((button) => {
      const selected = button.dataset.appView === currentView;
      if (selected) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });

    const panel = panelFor(currentView);
    const details = panel?.querySelector('details');
    if (details) details.open = true;
    if (scroll) panel?.scrollIntoView({ behavior: 'auto', block: 'start' });
    if (focus) buttonFor(currentView)?.focus({ preventScroll: true });
    return currentView;
  }

  buttons.forEach((button) => {
    button.addEventListener('click', () => showView(button.dataset.appView));
  });

  showView(currentView, { scroll: false });

  return {
    showView,
    currentView: () => currentView
  };
}
