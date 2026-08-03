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
| Version 2 lifecycle UI | complete | PR #15 merged local numbering, immutable history, revisions, finalized duplication, output regeneration, and controlled statuses. |
| Version 2 workspace navigation | complete | PR #17 merged separate Quote, Library, Customers, and Catalog workspaces without changing local data or customer-safe output. |
| Version 2 navigation design hardening | complete | PR #18 merged with passing CI and a successful Pages deployment. |
| Approve quote-number year policy | complete | Owner approved the finalization date's year. |
| Approve Version 2 status transitions | complete | Finalized → Sent/Cancelled; Sent → Accepted/Declined/Expired/Cancelled; outcomes are terminal. |
| Approve revision source policy | complete | Revisions start only from the latest finalized version; historical versions remain viewable for output. |
| Version 2 release hardening | complete | PR #19 head `22cf299` merged as `3e41007`; CI run `30130612587`, Pages run `30132341911`, production smoke, rollback/re-entry, and owner acceptance passed. |
| Approve customer/contact matching | complete | Owner accepted current Version 2 behavior: stable IDs for deliberate selection; otherwise first exact normalized company match, then exact email or blank-email exact buyer-name reuse. |
| Improve ambiguous customer/contact matching | later | Consider same-name company disambiguation and confirmation before blank-email name-only reuse in a separately approved slice. |
| Approve duplicate reset policy | complete | Reset number/status/events/date/expiration; retain customer, items/pricing, rep, shipping, terms, and notes; keep `DUP` until first successful save. |
| Defer deletion/archive policy | complete | Deletion, archive, and abandoned-revision cleanup remain outside Version 2 and require a separate approved roadmap slice. |
| Version 2 physical acceptance | complete | Samsung Galaxy S24 Ultra/Chrome and Dell desktop/Chrome passed on 2026-07-27; owner approved Chrome as the laptop Edge substitution. |
| Version 2 stable closeout | complete | PR #20 merged as `b61890c`; CI run `30304252373`, Pages run `30304688708`, live stable smoke, and annotated tag `v2.0.0` are verified. |
| Version 2.5 backup and restore | in progress | PR 1 backup foundation is active: complete readonly snapshots, deterministic SHA-256 envelope, record/reference/hash validation, and release-document synchronization. Download UI and all restore writes remain later gated PRs. |
