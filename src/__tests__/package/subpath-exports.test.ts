import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ParameterBindingStyle } from "../../driver/index";
import { ConnectionException } from "../../exception/index";
import * as Root from "../../index";
import { ConsoleLogger } from "../../logging/index";
import { AbstractPlatform } from "../../platforms/index";
import { Converter } from "../../portability/index";
import { QueryBuilder } from "../../query/index";
import { Schema } from "../../schema/module";
import { Parser } from "../../sql/index";
import { DsnParser } from "../../tools/index";
import { Type } from "../../types/index";

describe("package subpath namespaces", () => {
  it("keeps root exports limited to top-level src modules", () => {
    expect(Root.Connection).toBeDefined();
    expect(Root.DriverManager).toBeDefined();
    expect(Root.Query).toBeDefined();
    expect(Root.ParameterType).toBeDefined();

    expect("DsnParser" in Root).toBe(false);
    expect("QueryBuilder" in Root).toBe(false);
    expect("AbstractPlatform" in Root).toBe(false);
    expect("Type" in Root).toBe(false);
    expect("Logging" in Root).toBe(false);
    expect("Portability" in Root).toBe(false);
    expect("SchemaModule" in Root).toBe(false);
  });

  it("exposes top-level namespace barrels", () => {
    expect(ParameterBindingStyle.NAMED).toBe("named");
    expect(ConnectionException).toBeDefined();
    expect(ConsoleLogger).toBeDefined();
    expect(AbstractPlatform).toBeDefined();
    expect(Converter).toBeDefined();
    expect(QueryBuilder).toBeDefined();
    expect(Schema).toBeDefined();
    expect(Parser).toBeDefined();
    expect(DsnParser).toBeDefined();
    expect(Type).toBeDefined();
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
