# v4.0 release audit

Audit date: 2026-07-16

## Result

**Blocked pending external release setup and rehearsal.** Source checks pass, but the first GitHub release and website deployment have not yet occurred.

## Fixed findings

| Severity | Finding | Resolution |
| --- | --- | --- |
| High | The configured updater URL returned 404. | Packaged releases now target the GitHub Release `latest.json` asset. |
| Moderate | Website production dependency audit reported PostCSS XSS exposure. | Locked PostCSS to `8.5.19` through the website package override; production audit is clean. |
| Moderate | Local scripts required unavailable OS code-signing certificates. | Builds now intentionally produce unsigned DMG/EXE installers while retaining Tauri updater signatures. |
| Low | Desktop web origin configuration was ignored by frontend and Rust community windows. | Both now read the validated release origin; release CSP uses the same origin. |

## Security review

- Tauri CSP limits network access to the configured website origin and GitHub for updater checks.
- Community windows accept only fixed website paths and validate optional lesson UUIDs.
- Public pack downloads are parsed and checksum-verified before import.
- Website test coverage confirms Supabase-backed authorization, same-origin mutation checks, CORS limits, rate limiting, JSON sanitization, and protected moderation/admin paths.
- The retained `legacy-api` modules are active through the App Router bridge; they are not dead code.
- Desktop production dependency audit: 0 vulnerabilities. Website production dependency audit: 0 vulnerabilities after the PostCSS override.

## Required release-owner actions

1. Create GitHub Environment `production`, require reviewer approval, and add `FYDOR_UPDATER_PUBKEY` plus `TAURI_SIGNING_PRIVATE_KEY` secrets.
2. Deploy the website redirect and `/install` page.
3. Run the release workflow for `4.0.0`; verify its GitHub assets, signatures, `latest.json`, and download redirects.
4. Smoke-test Exchange browse/install, contributor/moderator/admin windows, and an update from a prior build.
5. Accept the documented unsigned-installer warnings on macOS and Windows before approval.

## Verification completed

- Desktop: typecheck, tests, lint, production build, Rust tests, and Rust format check passed.
- Website: typecheck, tests, lint, and production build passed.
- Shell release scripts passed syntax checks; generated Tauri release config was checked for the GitHub updater URL and CSP origin.

## Accepted risks

- Unsigned DMG and EXE files will trigger platform reputation/security warnings. The website provides manual, OS-specific guidance but cannot bypass those checks.
- A live updater and release asset verification require the protected GitHub workflow and cannot be completed locally without its secrets.
