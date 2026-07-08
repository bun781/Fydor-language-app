import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();

describe("desktop API command contract", () => {
  it("keeps TypeScript invoke names registered in Tauri", () => {
    const invokedCommands = extractInvokedCommands(readFile("lib/desktopApi.ts"));
    const registeredCommands = extractRegisteredCommands(readFile("src-tauri/src/main.rs"));
    const rustCommands = extractRustCommands(join(repoRoot, "src-tauri/src"));

    expect([...invokedCommands].sort()).toEqual([...registeredCommands].sort());
    expect([...registeredCommands].filter((command) => !rustCommands.has(command))).toEqual([]);
  });
});

function readFile(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

function extractInvokedCommands(source: string) {
  return new Set([...source.matchAll(/invoke\("([^"]+)"/g)].map((match) => match[1]));
}

function extractRegisteredCommands(source: string) {
  const handlerMatch = source.match(/tauri::generate_handler!\s*\\?\[\s*([\s\S]*?)\s*\]/);
  if (!handlerMatch) return new Set<string>();

  return new Set(
    handlerMatch[1]
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => entry.split("::").at(-1) ?? entry)
  );
}

function extractRustCommands(dir: string): Set<string> {
  const commands = new Set<string>();

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const command of extractRustCommands(fullPath)) commands.add(command);
      continue;
    }
    if (!entry.name.endsWith(".rs")) continue;

    const source = readFileSync(fullPath, "utf8");
    for (const match of source.matchAll(/#\[tauri::command\]\s*(?:pub\s+)?(?:async\s+)?fn\s+([a-zA-Z0-9_]+)/g)) {
      commands.add(match[1]);
    }
  }

  return commands;
}
