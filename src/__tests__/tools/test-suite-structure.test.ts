import { existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

type MirroredTestCase = {
  sourcePath: string;
  expectedTestPath: string;
  legacyTestPath?: string;
};

type DoctrineTopLevelDirectoryCase = {
  doctrineDir: string;
  expectedTestDir: string;
  excludedReason?: string;
};

type DoctrineRootFileCase = {
  doctrineFile: string;
  expectedAnyOf?: string[];
  excludedReason?: string;
};

const mirroredCases: MirroredTestCase[] = [
  {
    sourcePath: "src/expand-array-parameters.ts",
    expectedTestPath: "src/__tests__/connection/expand-array-parameters.test.ts",
    legacyTestPath: "src/__tests__/parameter/expand-array-parameters.test.ts",
  },
];

const doctrineTopLevelDirectoryCases: DoctrineTopLevelDirectoryCase[] = [
  {
    doctrineDir: "Cache",
    expectedTestDir: "src/__tests__/cache",
    excludedReason: "Query cache profile/result cache layer is not ported yet.",
  },
  {
    doctrineDir: "Connection",
    expectedTestDir: "src/__tests__/connection",
  },
  {
    doctrineDir: "Driver",
    expectedTestDir: "src/__tests__/driver",
  },
  {
    doctrineDir: "Exception",
    expectedTestDir: "src/__tests__/exception",
  },
  {
    doctrineDir: "Functional",
    expectedTestDir: "src/__tests__/functional",
    excludedReason: "Cross-driver functional integration matrix is not ported to Vitest yet.",
  },
  {
    doctrineDir: "Logging",
    expectedTestDir: "src/__tests__/logging",
  },
  {
    doctrineDir: "Platforms",
    expectedTestDir: "src/__tests__/platforms",
  },
  {
    doctrineDir: "Portability",
    expectedTestDir: "src/__tests__/portability",
  },
  {
    doctrineDir: "Query",
    expectedTestDir: "src/__tests__/query",
  },
  {
    doctrineDir: "Schema",
    expectedTestDir: "src/__tests__/schema",
  },
  {
    doctrineDir: "SQL",
    expectedTestDir: "src/__tests__/sql",
  },
  {
    doctrineDir: "Tools",
    expectedTestDir: "src/__tests__/tools",
  },
  {
    doctrineDir: "Types",
    expectedTestDir: "src/__tests__/types",
  },
];

const doctrineRootFileCases: DoctrineRootFileCase[] = [
  {
    doctrineFile: "ConfigurationTest.php",
    expectedAnyOf: ["src/__tests__/configuration.test.ts"],
  },
  {
    doctrineFile: "ConnectionTest.php",
    expectedAnyOf: [
      "src/__tests__/connection.test.ts",
      "src/__tests__/connection/connection-transaction.test.ts",
      "src/__tests__/connection/connection-data-manipulation.test.ts",
    ],
  },
  {
    doctrineFile: "DriverManagerTest.php",
    expectedAnyOf: [
      "src/__tests__/driver-manager.test.ts",
      "src/__tests__/driver/driver-manager.test.ts",
    ],
  },
  {
    doctrineFile: "ExceptionTest.php",
    expectedAnyOf: [
      "src/__tests__/exception.test.ts",
      "src/__tests__/exception/exceptions.test.ts",
    ],
  },
  {
    doctrineFile: "FunctionalTestCase.php",
    excludedReason:
      "PHPUnit base class and shared-connection lifecycle helper are PHP/Vitest-harness specific.",
  },
  {
    doctrineFile: "TestUtil.php",
    excludedReason:
      "PHP global/bootstrap database test utility is PHP-specific and not ported to Node/Vitest.",
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

  describe("Doctrine DBAL top-level tests directory parity", () => {
    describe.each(doctrineTopLevelDirectoryCases)("$doctrineDir", (entry) => {
      it("tracks the category as mirrored or explicitly excluded", () => {
        const doctrinePath = `references/dbal-full/tests/${entry.doctrineDir}`;
        expect(existsSync(doctrinePath)).toBe(true);

        if (entry.excludedReason !== undefined) {
          expect(entry.excludedReason.length).toBeGreaterThan(0);
          return;
        }

        expect(existsSync(entry.expectedTestDir)).toBe(true);
      });
    });
  });

  describe("Doctrine DBAL root-level test file parity", () => {
    describe.each(doctrineRootFileCases)("$doctrineFile", (entry) => {
      it("maps to an equivalent TS test file or an explicit exclusion", () => {
        const doctrinePath = `references/dbal-full/tests/${entry.doctrineFile}`;
        expect(existsSync(doctrinePath)).toBe(true);

        if (entry.excludedReason !== undefined) {
          expect(entry.excludedReason.length).toBeGreaterThan(0);
          return;
        }

        expect(entry.expectedAnyOf).toBeDefined();
        expect(entry.expectedAnyOf?.some((path) => existsSync(path))).toBe(true);
      });
    });
  });
});
