import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import * as DriverModule from "../../driver";

describe("package subpath namespaces", () => {
  it("does not expose non-doctrine ParameterBindingStyle in public driver API", () => {
    expect("ParameterBindingStyle" in DriverModule).toBe(false);
  });

  it("omits source namespace barrels during the rewrite phase", () => {
    expect(existsSync(new URL("../../driver/index.ts", import.meta.url))).toBe(false);
    expect(existsSync(new URL("../../exception/index.ts", import.meta.url))).toBe(false);
    expect(existsSync(new URL("../../logging/index.ts", import.meta.url))).toBe(false);
    expect(existsSync(new URL("../../platforms/index.ts", import.meta.url))).toBe(false);
    expect(existsSync(new URL("../../portability/index.ts", import.meta.url))).toBe(false);
    expect(existsSync(new URL("../../query/index.ts", import.meta.url))).toBe(false);
    expect(existsSync(new URL("../../sql/index.ts", import.meta.url))).toBe(false);
    expect(existsSync(new URL("../../tools/index.ts", import.meta.url))).toBe(false);
    expect(existsSync(new URL("../../types/index.ts", import.meta.url))).toBe(false);
  });

  it("declares package subpath exports for namespaces", () => {
    const raw = readFileSync(new URL("../../../package.json", import.meta.url), "utf8");
    const pkg = JSON.parse(raw) as {
      exports?: Record<string, string | Record<string, string>>;
    };

    expect(pkg.exports).toBeDefined();
    expect(pkg.exports?.["."]).toMatchObject({
      import: "./dist/index.js",
      require: "./dist/index.cjs",
      types: "./dist/index.d.ts",
    });

    for (const key of [
      "./driver",
      "./exception",
      "./logging",
      "./platforms",
      "./portability",
      "./query",
      "./schema",
      "./sql",
      "./tools",
      "./types",
    ]) {
      expect(pkg.exports?.[key]).toBeDefined();
    }
  });
});
