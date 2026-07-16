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
| Version 2 library-list usability | complete | PR #14 merged ten-at-a-time results and the temporary duplicate review state. |
| Version 2 lifecycle UI | ready for owner review | Branch `feature/v2-quote-lifecycle` adds local numbering, immutable history, revisions, finalized duplication, output regeneration, and controlled statuses; automated cross-browser/PDF/build checks pass. |
| Approve quote-number year policy | complete | Owner approved the finalization date's year. |
| Approve Version 2 status transitions | complete | Finalized → Sent/Cancelled; Sent → Accepted/Declined/Expired/Cancelled; outcomes are terminal. |
| Approve revision source policy | complete | Revisions start only from the latest finalized version; historical versions remain viewable for output. |
| Version 2 release hardening | next | After lifecycle review, run upgrade/failure/recovery and final Android/laptop acceptance before marking Version 2 complete. |
| Approve customer/contact matching | owner input before V2 stable | Current provisional rule uses exact normalized company name, then contact email (or name when email is blank). |
