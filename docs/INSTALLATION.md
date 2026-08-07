# Install the GTM Calc and Quote Tool

Version 3 install metadata lets supported phones add the public GitHub Pages application to the home screen. After one successful online launch, the current slice caches the public application shell so the calculator and existing saved browser data can reopen offline. PDFs are still generated locally, but email apps need a connection to send and a failed download/share action should be retried after reconnecting.

Application URL: <https://sactowilly.github.io/gtm-calc/>

## Updating an older installed copy

Version markers and install metadata can remain visible in an already-open tab or home-screen window until it reloads the current Pages files. If the computer shows a newer marker than the phone:

1. Close the home-screen app window and any open GTM Calc tab.
2. Open <https://sactowilly.github.io/gtm-calc/?refresh=1> in the phone's normal browser and reload once.
3. Confirm the marker under the title shows the current release before reopening or reinstalling the home-screen shortcut.

This release uses a service worker for public application files only. Avoid **Clear site data** unless you have downloaded a backup first: quotes, customers, catalog data, and settings are stored locally in the browser and clearing site data can remove them.

## Android — Chrome

1. Open the application URL in Chrome.
2. Open Chrome's menu.
3. Choose **Install app** or **Add to Home screen**, depending on the Chrome version.
4. Confirm the displayed name and installation.
5. Open **GTM Quote** from the home screen.

If the install option is unavailable, reload the page while online and confirm the address begins with `https://sactowilly.github.io/gtm-calc/`.

## iPhone — Safari

1. Open the application URL in Safari.
2. Tap **Share**.
3. Choose **Add to Home Screen**. Scroll the action list if necessary.
4. Confirm the displayed name and tap **Add**.
5. Open **GTM Quote** from the home screen.

Safari does not use Chrome's install prompt. The Share menu is the normal iPhone installation path.

## Laptop fallback

Continue using the GitHub Pages URL in Chrome, Edge, Firefox, or Safari. Browser installation availability varies, but the normal tab-based application remains supported.

## Data reminder

Quotes, customers, catalogs, settings, and backups remain local to the browser/profile and device. Installing the application does not synchronize data between a phone and laptop. Download a complete backup from **Export** before clearing browser data, uninstalling, or changing devices.

## Uninstalling

Removing the home-screen icon or installed application may not remove browser storage immediately, but browser behavior varies. Download a complete backup first. Reinstalling from the same GitHub Pages origin should use the same browser-local data when the browser retains it.
