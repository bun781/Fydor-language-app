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

const webOrigin = requireOrigin("FYDOR_RELEASE_WEB_ORIGIN", process.env.FYDOR_RELEASE_WEB_ORIGIN || "https://fydor.vercel.app");

const config = {
  app: {
    security: {
      csp: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' asset: data: blob:; font-src 'self' data:; connect-src 'self' ipc: http://ipc.localhost ${webOrigin}; object-src 'none'; base-uri 'none'; frame-src 'none'`
    }
  },
  bundle: {}
};

const dir = mkdtempSync(join(tmpdir(), "fydor-tauri-release-"));
const path = join(dir, "tauri.release.conf.json");
writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
console.log(path);
