# Project Working Rules

These repository-level rules apply to every implementation, release, and documentation task.

## Version and roadmap maintenance

1. After any application version, subversion, package version, or milestone-status change, inspect the roadmap infographic and `docs/PRODUCT_ROADMAP.md` in the same change set.
2. Update the roadmap infographic whenever the current phase, completed phase, next phase, feature summary, or milestone wording has changed. A build-only subversion bump may leave the artwork unchanged only after it has been reviewed and still matches the roadmap.
3. For every full or half product-version change (`1.0`, `1.5`, `2.0`, `2.5`, and so on), update all release-facing documentation in the same pull request:
   - `README.md`, including the roadmap summary and infographic reference.
   - `docs/PRODUCT_ROADMAP.md`.
   - `docs/CURRENT_STATE.md`.
   - The applicable implementation plan and `docs/TEST_PLAN.md`.
   - `BUILD-LOG.md`, `build-docs/DECISIONS.md`, and `build-docs/OPEN_ITEMS.md` when their status or decisions changed.
4. Keep the visible application marker, package version, tests, README roadmap text, product-roadmap text, and infographic status labels consistent.
5. Do not mark a roadmap milestone complete until its acceptance criteria have passed and owner acceptance has been recorded when required.

## Release verification

- Record only checks that were actually run.
- Preserve the current calculation, customer-privacy, local-storage, and GitHub Pages compatibility boundaries unless a separately approved change explicitly updates them.
- Feature branches and pull requests must not deploy production.
