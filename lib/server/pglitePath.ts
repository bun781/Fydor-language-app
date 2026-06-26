import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const APP_NAME = "Fydor";
const PGLITE_DIR_NAME = "pglite";

export interface PglitePaths {
  dataDir: string;
  migratedFrom?: string;
}

function appDataRoot(): string {
  if (process.env.PGLITE_DATA_DIR) return path.dirname(process.env.PGLITE_DATA_DIR);

  if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    if (!appData) throw new Error("APPDATA is not set; cannot resolve app data directory.");
    return path.join(appData, APP_NAME);
  }

  const home = os.homedir();
  if (!home) throw new Error("Unable to resolve home directory for app data.");

  if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support", APP_NAME);
  }

  return path.join(process.env.XDG_DATA_HOME ?? path.join(home, ".local", "share"), APP_NAME);
}

function moduleRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
}

function oldRepoLocalDataDirs(): string[] {
  const root = moduleRoot();
  return [path.join(root, "test-pglite"), path.join(root, ".pglite-data")];
}

function isDirectoryEmpty(dir: string): boolean {
  return !fs.existsSync(dir) || fs.readdirSync(dir).length === 0;
}

function copyDirectoryContents(source: string, destination: string): void {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source)) {
    if (entry === "postmaster.pid") continue;

    fs.cpSync(path.join(source, entry), path.join(destination, entry), {
      recursive: true,
      errorOnExist: true,
      force: false
    });
  }
}

export function resolvePglitePaths(): PglitePaths {
  const dataDir = process.env.PGLITE_DATA_DIR ?? path.join(appDataRoot(), PGLITE_DIR_NAME);

  try {
    fs.mkdirSync(dataDir, { recursive: true });

    let migratedFrom: string | undefined;
    if (isDirectoryEmpty(dataDir)) {
      const oldDir = oldRepoLocalDataDirs().find((candidate) => fs.existsSync(candidate));
      if (oldDir) {
        // Runtime data belongs in OS app data, not the source tree.
        copyDirectoryContents(oldDir, dataDir);
        migratedFrom = oldDir;
      }
    }

    return { dataDir, migratedFrom };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to prepare PGlite data directory at ${dataDir}: ${message}`);
  }
}

export function resolveMigrationDir(): string {
  const explicit = process.env.PGLITE_MIGRATIONS_DIR;
  if (explicit) return explicit;

  const migrationDir = path.join(moduleRoot(), "db", "migrations");
  if (!fs.existsSync(migrationDir)) {
    throw new Error(`Unable to find PGlite migrations at ${migrationDir}.`);
  }

  return migrationDir;
}
