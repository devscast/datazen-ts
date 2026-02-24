import { existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

type MirroredTestCase = {
  sourcePath: string;
  expectedTestPath: string;
  legacyTestPath?: string;
};

const mirroredCases: MirroredTestCase[] = [
  {
    sourcePath: "src/expand-array-parameters.ts",
    expectedTestPath: "src/__tests__/expand-array-parameters.test.ts",
    legacyTestPath: "src/__tests__/parameter/expand-array-parameters.test.ts",
  },
];

describe("test suite structure parity (incremental)", () => {
  describe.each(mirroredCases)("$sourcePath", ({
    expectedTestPath,
    legacyTestPath,
    sourcePath,
  }) => {
    it("keeps the test in the mirrored src/__tests__ path", () => {
      expect(existsSync(sourcePath)).toBe(true);
      expect(existsSync(expectedTestPath)).toBe(true);
    });

    it("does not leave a legacy grouped-path duplicate behind", () => {
      if (legacyTestPath === undefined) {
        return;
      }

      expect(existsSync(legacyTestPath)).toBe(false);
    });
  });
});
