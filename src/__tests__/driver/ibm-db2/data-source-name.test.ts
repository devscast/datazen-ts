import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("IBMDB2 DataSourceName parity scaffold", () => {
  it("tracks that the IBM DB2 DSN helper is not implemented in the Node port", () => {
    const sourcePath = resolve(process.cwd(), "src/driver/ibm-db2/data-source-name.ts");

    expect(existsSync(sourcePath)).toBe(false);
  });

  it.skip(
    "ports Doctrine DataSourceName::fromConnectionParameters() formatting rules if/when an IBM DB2 driver adapter is added",
  );
});
