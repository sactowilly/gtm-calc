# Open Items

| Item | Status | Notes |
|---|---|---|
| Keep the memory layer current during future work | open | Add dated log entries, record locked decisions, and update blockers as they appear. |
| Version 1.5 catalog UI and local adapter | complete | PR #10 merged; owner imported and searched a representative CSV and confirmed My Items persistence. |
| Retain a sanitized production catalog fixture | as needed | The real import succeeded. Add sanitized examples only when a real-data defect or special header/UOM case needs regression coverage. |
| Confirm duplicate SKU policy | provisional | Current foundation rejects later duplicate normalized SKUs and reports each rejected row. |
| Validate catalog storage volume | monitor | The representative CSV fit and worked. Revisit only if a larger catalog approaches the visible import limit or browser quota. |
| Version 2 quote-library foundation | complete | PR #11 merged with passing CI. |
| Version 2 draft-library UI | complete | PR #12 merged; opt-in import, draft search/reopen/duplicate, customer recall, fallback save, and stale-tab protection are implemented. |
| Version 2 library-list usability | ready for review | Branch `feature/v2-library-list-usability` shows ten recent matches at a time and highlights a new duplicate until its first successful save, without changing customer data. |
| Approve quote-number year policy | owner input needed before PR 15 | Choose quote-date year or finalization-date year. The foundation requires an explicit year and does not decide automatically. |
| Approve Version 2 status transitions | owner input needed before PR 15 | Define allowed transitions and whether accepted/declined/expired/cancelled records can be reopened. |
| Approve customer/contact matching | owner input before V2 stable | Current provisional rule uses exact normalized company name, then contact email (or name when email is blank). |
