# Security release audit — 2026-07-16

Decision: **BLOCK RELEASE**

Scope: the Fydor Tauri desktop app, `fydor-website` Next.js app, their Supabase
integration, release scripts, checked-in CI, and supplied installer artifacts.
No production account, database, deployment, or signing service was accessed.

## Architecture and threat model

The desktop app is a local Vite/React renderer backed by Tauri Rust commands and
a SQLite database in the OS app-data directory. It opens the contributor,
moderation, and administration website. The website is a Next.js App Router app
using Supabase Auth, REST/RPC, and Storage. The App Router bridge derives a
server-side bearer token from the authenticated same-origin session; privileged
database operations use a server-only service-role key.

Primary trust boundaries: untrusted lesson/pack JSON into Rust and website
validation; renderer-to-Tauri IPC; website browser-to-API; API-to-Supabase;
administrator/moderator roles; and CI-to-release artifacts/updater metadata.
The principal attackers considered were a malicious lesson importer, a malicious
website or browser script, a compromised contributor account, a cross-origin
browser requester, and a release-artifact distributor.

## Attack-surface inventory

| Area | Reviewed surface |
| --- | --- |
| Tauri IPC | 38 registered commands: lessons, annotations, curriculum, packs, review, reading, pack export, and external links |
| Native integrations | opener; native save dialog; optional signed updater |
| Tauri configuration | `src-tauri/tauri.conf.json`, CSP, release config generation, updater setup |
| Website routes | all App Router pages, `/auth/callback`, `/api/[endpoint]`, proxy/middleware |
| Website APIs | `admin`, `contributor`, `moderation`, `library`, `download-count`, `client-config`, retired `packs` |
| Auth and authorization | Supabase browser/server clients; bearer-token verification; database roles, RLS/RPC-backed workflow checks |
| Supply chain | npm/Cargo manifests and lockfiles; GitHub CI/release workflows; release scripts; supplied DMG/EXE |

## Authentication and authorization matrix

| Resource | Enforcement |
| --- | --- |
| Contributor drafts/submissions | authenticated Supabase user plus `creator_id`/`owner_id` query constraints and role checks |
| Moderator queue/actions | `moderator` role plus language assignment and active-reviewer assertions |
| Admin management/archive | `admin`/`super_admin`, with super-admin elevation limits in database RPCs |
| Public library | public read only; direct publishing endpoint returns 410 |
| Tauri local data | local desktop user only; no backend identity boundary is implemented or needed for local SQLite data |

## Source-confirmed findings

### F-001 — High — fixed

**Remote website content was loaded in a privileged Tauri webview.**

Affected file: `src-tauri/src/external_links.rs`.

`open_community_workspace` created a `WebviewWindow` at the remote Fydor
website origin. In the absence of an origin-specific capability boundary, a
website compromise or renderer XSS could share the desktop application's IPC
context and invoke local-data commands. This was a source-confirmed unsafe
native trust boundary; a malicious live website was not tested.

Fix: community destinations now open in the system browser through the existing
allowlisted opener path. Destination names, HTTPS origin validation, and UUID
validation remain enforced. No remote document is hosted in a Tauri webview.

Validation: Rust tests, formatting, and the desktop TypeScript test suite pass.
Rollback: restore only after an explicit Tauri capability model limits every
native command to trusted local windows and remote navigation is independently
blocked.

### F-002 — High — contained; external remediation required

**Existing installers are not platform-code-signed, and supplied artifacts
cannot be linked to an approved source commit.**

Evidence: the supplied installer copies had no verifiable signing or provenance
evidence at audit time. Their SHA-256 hashes are:

| Artifact | SHA-256 |
| --- | --- |
| `fydor-mac.dmg` | `54bd9d723f2e5588ad5535db865460cc5dc18e20df8639ba65e9d22cf975d2bb` |
| `fydor-windows.exe` | `a8fedfa0d0ce6eae3ad557ce10b3f6c4e089cb35094bf3f2da016349bbe4b83c` |

The updater payload is configured to require Tauri signatures, but direct DMG
and EXE installation still lacks platform publisher verification. No signed,
immutable release provenance or artifact-to-commit attestation was available.

Containment applied: the release workflow now rejects unsigned macOS and Windows
installers and publishes `SHA256SUMS`. Remaining remediation requires an Apple
signing/notarization identity and Windows Authenticode identity in the protected
release environment, followed by clean-host verification.

## Hardening recommendations

1. Re-audit the explicit Tauri capability scoped to the `main` local window
   whenever a plugin or window is added.
2. Keep untrusted HTML prohibited and retain the strict CSP; browser-side
   Supabase auth flows still require careful XSS prevention.
3. Configure a reliable, required production rate limiter for public endpoints;
   the optional public library limiter deliberately fails open on provider
   failure.
4. Pin CI actions to commit SHAs, restrict release workflow dispatch to a
   protected branch, and enable repository branch protection outside source
   control.
5. Run a registry-backed npm/Cargo vulnerability scan in an approved CI
   environment and retain its report/SBOM with each release.

## Changes made

- `src-tauri/src/external_links.rs`: removed remote Tauri webviews for community
  pages; opens fixed HTTPS destinations in the system browser.
- `src-tauri/capabilities/default.json`: scoped core and opener permissions to
  the bundled `main` window.
- `fydor-website/next.config.ts`: added HSTS, anti-framing, MIME-sniffing,
  referrer, and permissions-policy headers for all website responses.
- `fydor-website/app/api/[endpoint]/route.ts` and `lib/website-api.ts`: browser
  API calls no longer read or transmit a bearer token; the server derives it
  from the same-origin Supabase session.
- `fydor-website/lib/http.js`: state-changing calls now require an explicit
  trusted `Origin`; regression coverage rejects absent origins.
- `.github/workflows/release.yml`: release publication rejects unsigned desktop
  installers and records artifact hashes.

## Validation and limitations

Passed:

- Root: `npm run typecheck`, `npm test` (159 tests), `npm run lint`, `npm run build`
- Rust: `cargo fmt --check`, `cargo test` (35 tests)
- Website: `npm run typecheck`, `npm test` (72 tests), `npm run lint`, `npm run build`

`npm audit --omit=dev --package-lock-only --audit-level=high` could not run:
the sandbox had no DNS access, and an external registry query was not approved.
No dependency vulnerability conclusion is made from that failed scan.

The release build requiring signing credentials was not produced, and no live
Supabase RLS, deployment-header, callback, or updater endpoint test was
authorized. These remain release verification requirements.

## Remaining risk and containment

Do not publish the supplied installers. If they were already distributed,
replace them with signed versioned builds and communicate the verified hashes.
If updater signing material is suspected exposed, rotate it before publishing.
Require a release owner to verify protected CI environments, signing identity,
notarization/Authenticode status, and artifact provenance before re-review.
