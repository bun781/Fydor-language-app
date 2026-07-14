import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

function requireOrigin(name, value) {
  if (!value) fail(`${name} is required.`);
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`${name} must be an absolute URL.`);
  }
  if (url.protocol !== "https:") fail(`${name} must use HTTPS for packaged releases.`);
  if (url.username || url.password || url.search || url.hash || !/^\/*$/.test(url.pathname)) {
    fail(`${name} must be an origin only, with no path, credentials, query, or fragment.`);
  }
  return url.origin;
}

function requireHttpsUrl(name, value) {
  if (!value) fail(`${name} is required.`);
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`${name} must be an absolute URL.`);
  }
  if (url.protocol !== "https:") fail(`${name} must use HTTPS for packaged releases.`);
  if (url.username || url.password) fail(`${name} cannot contain credentials.`);
  return url.toString();
}

const webOrigin = requireOrigin("FYDOR_RELEASE_WEB_ORIGIN", process.env.FYDOR_RELEASE_WEB_ORIGIN || "https://fydor.vercel.app");
const endpoint = requireHttpsUrl(
  "FYDOR_UPDATER_ENDPOINT",
  process.env.FYDOR_UPDATER_ENDPOINT || `${webOrigin}/downloads/latest.json`
);
const pubkey = (process.env.FYDOR_UPDATER_PUBKEY || "").trim();
if (!pubkey) fail("FYDOR_UPDATER_PUBKEY is required.");

const config = {
  bundle: {
    createUpdaterArtifacts: true
  },
  plugins: {
    updater: {
      pubkey,
      endpoints: [endpoint],
      windows: {
        installMode: "passive"
      }
    }
  }
};

if (process.env.FYDOR_MAC_SIGNING_IDENTITY) {
  config.bundle.macOS = {
    signingIdentity: process.env.FYDOR_MAC_SIGNING_IDENTITY
  };
}

const dir = mkdtempSync(join(tmpdir(), "fydor-tauri-release-"));
const path = join(dir, "tauri.release.conf.json");
writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
console.log(path);
