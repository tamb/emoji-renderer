/**
 * Regenerates src/generated/fluent-map.json from official Fluent Emoji metadata.
 *
 * Usage:
 *   node scripts/generate-fluent-map.mts
 *
 * Optional env:
 *   FLUENT_REPO   local clone of microsoft/fluentui-emoji (default: /tmp/fluentui-emoji)
 *   FLUENT_REF    git ref to check out (default: 62ecdc0d7ca5c6df32148c169556bc8d3782fca4)
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_REF = "62ecdc0d7ca5c6df32148c169556bc8d3782fca4";
const REPO_URL = "https://github.com/microsoft/fluentui-emoji.git";

const SKIN_TONES = {
  "1f3fb": "Light",
  "1f3fc": "Medium-Light",
  "1f3fd": "Medium",
  "1f3fe": "Medium-Dark",
  "1f3ff": "Dark",
} as const;

interface FluentMetadata {
  unicode?: string;
  unicodeSkintones?: string[];
}

export type FluentMapValue = string | [folder: string, tone: string];
export type FluentMap = Record<string, FluentMapValue>;

function unicodeToCodePoint(unicode: string): string {
  return unicode.trim().split(/\s+/).filter(Boolean).join("-").toLowerCase();
}

function stripFe0f(codePoint: string): string {
  return codePoint
    .replace(/(?:^|-)fe0f(?=-|$)/g, "")
    .replace(/^-|-$/g, "")
    .replace(/--+/g, "-");
}

function addEntry(map: FluentMap, codePoint: string, value: FluentMapValue): void {
  const keys = new Set([codePoint, stripFe0f(codePoint)]);
  for (const key of keys) {
    if (key.length === 0) {
      continue;
    }
    const existing = map[key];
    if (existing !== undefined && JSON.stringify(existing) !== JSON.stringify(value)) {
      throw new Error(
        `Conflicting Fluent map entry for ${key}: ${JSON.stringify(existing)} vs ${JSON.stringify(value)}`,
      );
    }
    map[key] = value;
  }
}

function toneFromUnicode(unicode: string): string {
  for (const part of unicode.trim().split(/\s+/)) {
    if (part in SKIN_TONES) {
      return SKIN_TONES[part as keyof typeof SKIN_TONES];
    }
  }
  return "Default";
}

function ensureRepo(repoDir: string, ref: string): void {
  if (!existsSync(path.join(repoDir, ".git"))) {
    execFileSync(
      "git",
      ["clone", "--filter=blob:none", "--sparse", "--no-checkout", REPO_URL, repoDir],
      { stdio: "inherit" },
    );
  }

  execFileSync("git", ["-C", repoDir, "fetch", "--depth", "1", "origin", ref], {
    stdio: "inherit",
  });
  execFileSync("git", ["-C", repoDir, "sparse-checkout", "set", "--no-cone", "**/metadata.json"], {
    stdio: "inherit",
  });
  execFileSync("git", ["-C", repoDir, "checkout", "--force", ref], { stdio: "inherit" });
}

async function collectMetadataFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMetadataFiles(full)));
    } else if (entry.name === "metadata.json") {
      files.push(full);
    }
  }

  return files;
}

async function generate(): Promise<void> {
  const repoDir = process.env.FLUENT_REPO ?? "/tmp/fluentui-emoji";
  const ref = process.env.FLUENT_REF ?? DEFAULT_REF;
  ensureRepo(repoDir, ref);

  const assetsDir = path.join(repoDir, "assets");
  const metadataFiles = await collectMetadataFiles(assetsDir);
  const map: FluentMap = {};

  for (const file of metadataFiles) {
    const metadata = JSON.parse(await readFile(file, "utf8")) as FluentMetadata;
    const folder = path.basename(path.dirname(file));
    if (typeof metadata.unicode !== "string" || metadata.unicode.trim().length === 0) {
      throw new Error(`Missing unicode in ${file}`);
    }

    if (metadata.unicodeSkintones && metadata.unicodeSkintones.length > 0) {
      for (const unicode of metadata.unicodeSkintones) {
        addEntry(map, unicodeToCodePoint(unicode), [folder, toneFromUnicode(unicode)]);
      }
    } else {
      addEntry(map, unicodeToCodePoint(metadata.unicode), folder);
    }
  }

  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const outDir = path.join(root, "src/generated");
  await mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, "fluent-map.json");
  await writeFile(outFile, `${JSON.stringify(map, null, 0)}\n`, "utf8");

  const values = Object.values(map);
  const withTone = values.filter((value) => Array.isArray(value)).length;
  console.log(
    `Wrote ${Object.keys(map).length} codepoints (${withTone} skintone rows) from ${metadataFiles.length} metadata files to ${outFile}`,
  );
}

await generate();
