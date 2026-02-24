import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function extractPhpPublicMethods(source: string): string[] {
  return [...source.matchAll(/public\s+function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)].map(
    (m) => m[1],
  );
}

function extractTsPublicMethods(source: string): string[] {
  return [...source.matchAll(/public\s+(?:abstract\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)].map(
    (m) => m[1],
  );
}

describe("AbstractPlatform public method surface parity (best effort)", () => {
  it("includes the public methods from the Datazen reference AbstractPlatform", () => {
    const phpSource = readFileSync(
      "references/dbal-full/src/Platforms/AbstractPlatform.php",
      "utf8",
    );
    const tsSource = readFileSync("src/platforms/abstract-platform.ts", "utf8");

    const phpMethods = new Set(extractPhpPublicMethods(phpSource));
    const tsMethods = new Set(extractTsPublicMethods(tsSource));

    const missing = [...phpMethods].filter(
      (method) => method !== "__construct" && !tsMethods.has(method),
    );

    expect(missing).toEqual([]);
  });
});
