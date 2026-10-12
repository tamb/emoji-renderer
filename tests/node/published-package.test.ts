import { spawn } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vite-plus/test";

const INSTALL_HINT =
  'Install optional peers "@napi-rs/canvas" and "@resvg/resvg-js" to rasterize emoji images in Node.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const distDir = path.join(root, "dist");
const ADAPTER_IMPORT = /["'](\.\/canvasEnv\.node(?:-[A-Za-z0-9_]+)?\.mjs)["']/;

const CONSUMER_SCRIPT = `import { emojiToImage } from "emoji-renderer";

try {
  const blob = await emojiToImage("🧟", {
    source: "noto",
    size: 128,
    pixelate: 10,
    format: "blob",
  });
  const bytes = Buffer.from(await blob.arrayBuffer());
  process.stdout.write(JSON.stringify({
    ok: true,
    type: blob.type,
    base64: bytes.toString("base64"),
  }));
} catch (error) {
  const cause = error instanceof Error ? error.cause : undefined;
  const causeError = cause instanceof Error ? cause : undefined;
  const causeCode =
    cause && typeof cause === "object" && "code" in cause && typeof cause.code === "string"
      ? cause.code
      : undefined;
  process.stdout.write(JSON.stringify({
    ok: false,
    name: error instanceof Error ? error.name : "Error",
    message: error instanceof Error ? error.message : String(error),
    causeMessage: causeError?.message,
    causeCode,
  }));
  process.exitCode = 1;
}
`;

interface ConsumerResult {
  ok: boolean;
  type?: string;
  base64?: string;
  name?: string;
  message?: string;
  causeMessage?: string;
  causeCode?: string;
}

function publishedChunks(): { name: string; code: string }[] {
  if (!existsSync(distDir)) {
    throw new Error(`Published dist/ is missing at ${distDir}. Run vp pack before this test.`);
  }

  const names = readdirSync(distDir).filter((name) => name.endsWith(".mjs"));
  if (names.length === 0) {
    throw new Error(`No published .mjs chunks in ${distDir}. Run vp pack before this test.`);
  }

  return names.map((name) => ({
    name,
    code: readFileSync(path.join(distDir, name), "utf8"),
  }));
}

function publishedAdapterFileName(): string {
  let adapterFileName: string | undefined;
  for (const chunk of publishedChunks()) {
    if (
      chunk.code.includes('"./canvasEnv.node.ts"') ||
      chunk.code.includes("'./canvasEnv.node.ts'")
    ) {
      throw new Error(`${chunk.name} still imports ./canvasEnv.node.ts`);
    }

    const match = chunk.code.match(ADAPTER_IMPORT);
    if (match?.[1]) {
      adapterFileName = match[1].slice(2);
    }
  }

  if (!adapterFileName) {
    throw new Error("Published bundle does not import a canvasEnv.node .mjs chunk");
  }

  if (!existsSync(path.join(distDir, adapterFileName))) {
    throw new Error(`Published adapter chunk ${adapterFileName} is missing from dist/`);
  }

  return adapterFileName;
}

function linkDependency(modulesDir: string, specifier: string): void {
  const target = path.join(modulesDir, specifier);
  mkdirSync(path.dirname(target), { recursive: true });
  symlinkSync(path.join(root, "node_modules", specifier), target);
}

function stageConsumer(options: { peers: boolean; removeAdapter?: boolean }): {
  dir: string;
  cleanup: () => void;
} {
  const dir = mkdtempSync(path.join(tmpdir(), "emoji-renderer-consumer-"));
  const modulesDir = path.join(dir, "node_modules");
  const packageDir = path.join(modulesDir, "emoji-renderer");
  mkdirSync(packageDir, { recursive: true });
  cpSync(path.join(root, "package.json"), path.join(packageDir, "package.json"));
  cpSync(distDir, path.join(packageDir, "dist"), { recursive: true });
  linkDependency(modulesDir, "@twemoji/api");

  if (options.peers) {
    linkDependency(modulesDir, "@napi-rs/canvas");
    linkDependency(modulesDir, "@resvg/resvg-js");
  }

  if (options.removeAdapter) {
    rmSync(path.join(packageDir, "dist", publishedAdapterFileName()));
  }

  writeFileSync(path.join(dir, "package.json"), JSON.stringify({ private: true, type: "module" }));
  writeFileSync(path.join(dir, "run.mjs"), CONSUMER_SCRIPT);

  return {
    dir,
    cleanup: () => {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

function runConsumer(cwd: string): Promise<ConsumerResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["run.mjs"], {
      cwd,
      env: { ...process.env, NODE_PATH: "" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`consumer timed out\n${stderr}`));
    }, 25_000);

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", () => {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(stdout) as ConsumerResult);
      } catch (error) {
        reject(
          new Error(
            `consumer did not print JSON\nstdout: ${stdout}\nstderr: ${stderr}\n${String(error)}`,
          ),
        );
      }
    });
  });
}

describe("published package", () => {
  test("ships the node canvas adapter as an .mjs chunk", () => {
    const adapterFileName = publishedAdapterFileName();
    expect(adapterFileName.endsWith(".mjs")).toBe(true);
    expect(existsSync(path.join(distDir, adapterFileName))).toBe(true);
  });

  test("rasterizes a pixelated Noto PNG when optional peers are installed", async () => {
    const consumer = stageConsumer({ peers: true });
    try {
      const result = await runConsumer(consumer.dir);
      expect(result.ok, JSON.stringify(result)).toBe(true);
      expect(result.type).toBe("image/png");

      const bytes = Buffer.from(result.base64 ?? "", "base64");
      expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

      const { loadImage } = await import(/* @vite-ignore */ "@napi-rs/canvas");
      const image = await loadImage(bytes);
      expect(image.width).toBe(128);
      expect(image.height).toBe(128);
    } finally {
      consumer.cleanup();
    }
  }, 30_000);

  test("rejects with the install hint when optional peers are absent", async () => {
    const consumer = stageConsumer({ peers: false });
    try {
      const result = await runConsumer(consumer.dir);
      expect(result.ok, JSON.stringify(result)).toBe(false);
      expect(result.name).toBe("RasterizeError");
      expect(result.message).toBe(INSTALL_HINT);
    } finally {
      consumer.cleanup();
    }
  }, 30_000);

  test("surfaces a missing adapter chunk instead of the install hint", async () => {
    const consumer = stageConsumer({ peers: true, removeAdapter: true });
    try {
      const result = await runConsumer(consumer.dir);
      expect(result.ok, JSON.stringify(result)).toBe(false);
      expect(result.message).not.toBe(INSTALL_HINT);
      expect(result.message).toContain("canvasEnv.node");
      expect(result.causeCode).toBe("ERR_MODULE_NOT_FOUND");
    } finally {
      consumer.cleanup();
    }
  }, 30_000);
});
