# Releasing Fydor v4

GitHub Releases are the only desktop artifact source. Do not copy installers into the website repository.

1. Configure the `production` GitHub Environment with required reviewers.
2. Add `FYDOR_UPDATER_PUBKEY` and `TAURI_SIGNING_PRIVATE_KEY` as Environment secrets. These sign updater payloads only; macOS and Windows installers remain unsigned.
3. Confirm the desktop manifest versions are the intended release version.
4. Run **Release desktop app** from the Actions tab and enter that version.
5. Approve the protected Environment, then verify the published assets and `latest.json` on the GitHub Release.
6. Verify `https://fydor.vercel.app/downloads/fydor-mac.dmg` and `fydor-windows.exe` redirect to the GitHub Release, and verify `/install` shows the platform instructions.

The updater endpoint is `https://github.com/bun781/Triolinga/releases/latest/download/latest.json`.
