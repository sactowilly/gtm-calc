# Version 1 Release Checklist

## Automated gates

- [ ] JavaScript syntax checks pass.
- [ ] Calculation, privacy, storage, mailto, and sharing unit tests pass.
- [ ] Chromium quotation/PDF layout tests pass.
- [ ] Chromium, Firefox, WebKit, emulated Android Chrome, and emulated iPhone Safari compatibility tests pass.
- [ ] Serious and critical automated accessibility findings are zero.
- [ ] Production build uses the `/gtm-calc/` base path.
- [ ] GitHub Pages production smoke passes after merge.

## Owner device acceptance

- [ ] Android Chrome: create/save/reload/edit a quote.
- [ ] Android Chrome: preview and download the customer PDF.
- [ ] Android Chrome: Share PDF attaches the named PDF in Gmail or Outlook.
- [ ] Android Chrome: customer PDF/email contains no cost, freight, GTM, margin, or internal notes.
- [ ] Laptop: download PDF, open rep email with blank recipient, and attach the named file manually.
- [ ] Laptop: customer email uses Buyer Email and remains customer-safe.
- [ ] Keyboard: tab order, visible focus, details disclosure, item editing, and PDF dialog are usable.
- [ ] Screen reader spot check: labels, status messages, quote actions, and dialog name are announced.

## Release and rollback

- [ ] Confirm no manifest, service worker, PWA, backend, authentication, or hosted database was added.
- [ ] Confirm `gtm_quote_calculator_v1` legacy data still loads.
- [ ] Record device/browser versions and test date below.
- [ ] After owner acceptance, mark the PR ready, merge, smoke-test production, and create annotated tag `v1.0.0`.
- [ ] Rollback: redeploy the prior customer-safe tag/merge commit; never restore an internal-cost customer PDF.

## Manual test record

| Date | Device/browser | Tester | Result/notes |
| --- | --- | --- | --- |
| YYYY-MM-DD | Android Chrome |  |  |
| YYYY-MM-DD | Laptop browser/email client |  |  |
