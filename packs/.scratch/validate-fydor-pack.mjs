import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const buildDir = path.join(import.meta.dirname, ".validator-build");

function compileTs(sourcePath, outName, rewrites = []) {
  let source = fs.readFileSync(sourcePath, "utf8");
  for (const [from, to] of rewrites) source = source.replaceAll(from, to);
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove
    },
    fileName: sourcePath
  }).outputText;
  fs.mkdirSync(buildDir, { recursive: true });
  fs.writeFileSync(path.join(buildDir, outName), output);
}

async function loadParser() {
  compileTs(path.join(repoRoot, "lib/safeJson.ts"), "safeJson.mjs");
  compileTs(path.join(repoRoot, "lib/fydor-pack.ts"), "fydor-pack.mjs", [
    ["@/lib/safeJson", "./safeJson.mjs"]
  ]);
  return import(pathToFileURL(path.join(buildDir, "fydor-pack.mjs")).href + `?t=${Date.now()}`);
}

const file = process.argv[2];
if (!file) {
  console.error("Usage: node packs/.scratch/validate-fydor-pack.mjs <pack.json>");
  process.exit(2);
}

const { parseFydorPack } = await loadParser();
const source = fs.readFileSync(path.resolve(repoRoot, file), "utf8");
const result = parseFydorPack(source);

console.log(JSON.stringify({
  file,
  lessonCount: result.lessonCount,
  sentenceCount: result.sentenceCount,
  errors: result.errors,
  warnings: result.warnings,
  lessonErrors: result.lessonErrors
}, null, 2));

if (result.errors.length || result.lessonErrors.length) process.exit(1);
