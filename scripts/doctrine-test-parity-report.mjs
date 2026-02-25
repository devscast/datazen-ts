import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const doctrineTestsDir = path.join(rootDir, "references", "dbal-full", "tests");
const datazenTestsDir = path.join(rootDir, "src", "__tests__");

if (!existsSync(doctrineTestsDir)) {
  console.error("Missing Doctrine reference tests at references/dbal-full/tests");
  process.exit(1);
}

if (!existsSync(datazenTestsDir)) {
  console.error("Missing Datazen tests at src/__tests__");
  process.exit(1);
}

function walkFiles(dir, matcher) {
  const results = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath, matcher));
      continue;
    }

    if (matcher(fullPath)) {
      results.push(fullPath);
    }
  }

  return results;
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function kebabCase(value) {
  const normalized = value
    .replace(/PgSQL/g, "Pgsql")
    .replace(/SQLSrv/g, "Sqlsrv")
    .replace(/MySQL/g, "Mysql")
    .replace(/SQLite/g, "Sqlite")
    .replace(/DB2/g, "Db2")
    .replace(/OCI8/g, "Oci8")
    .replace(/IBMDB2/g, "Ibmdb2");

  return normalized
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
}

function doctrineBaseName(relDoctrineFile) {
  const baseName = path.basename(relDoctrineFile, ".php");
  return baseName.endsWith("Test") ? baseName.slice(0, -4) : baseName;
}

function doctrineSegments(relDoctrineFile) {
  return relDoctrineFile
    .replace(/\.php$/, "")
    .replace(/Test$/, "")
    .split("/")
    .map((segment) => kebabCase(segment));
}

const exclusionRules = [
  {
    match: (rel) => rel === "FunctionalTestCase.php",
    reason: "PHPUnit-specific base test class (Vitest harness differs).",
  },
  {
    match: (rel) => rel === "TestUtil.php",
    reason: "PHP global/bootstrap test utility (Node/Vitest harness differs).",
  },
  {
    match: (rel) => rel.startsWith("Functional/"),
    reason: "Cross-driver functional integration suite not ported to Vitest yet.",
  },
  {
    match: (rel) => rel.startsWith("Cache/"),
    reason: "Query cache profile/result cache test surface not ported yet.",
  },
  {
    match: (rel) => rel === "Connection/CachedQueryTest.php",
    reason: "Cached query/profile API is not ported yet.",
  },
  {
    match: (rel) => rel.startsWith("Tools/Console/"),
    reason: "Doctrine console command integration tests are out of scope in this Node port.",
  },
  {
    match: (rel) => rel.startsWith("Driver/PDO/") || rel.startsWith("Driver/Mysqli/") || rel.startsWith("Driver/OCI8/"),
    reason: "PHP-native driver tests are out of scope for the Node port.",
  },
];

const aliasMap = new Map([
  ["ConfigurationTest.php", ["src/__tests__/configuration.test.ts"]],
  [
    "ConnectionTest.php",
    [
      "src/__tests__/connection.test.ts",
      "src/__tests__/connection/connection-transaction.test.ts",
      "src/__tests__/connection/connection-data-manipulation.test.ts",
      "src/__tests__/connection/connection-database-platform-version-provider.test.ts",
    ],
  ],
  ["DriverManagerTest.php", ["src/__tests__/driver-manager.test.ts", "src/__tests__/driver/driver-manager.test.ts"]],
  ["ExceptionTest.php", ["src/__tests__/exception.test.ts", "src/__tests__/exception/exceptions.test.ts"]],
  ["Exception/DriverRequiredTest.php", ["src/__tests__/exception/driver-required.test.ts"]],
  ["Query/QueryBuilderTest.php", ["src/__tests__/query/query-builder.test.ts"]],
  [
    "Query/Expression/CompositeExpressionTest.php",
    ["src/__tests__/query/expression/composite-expression.test.ts"],
  ],
  [
    "Query/Expression/ExpressionBuilderTest.php",
    ["src/__tests__/query/expression/expression-builder.test.ts"],
  ],
  ["Schema/ColumnTest.php", ["src/__tests__/schema/column.test.ts"]],
  ["Schema/IndexTest.php", ["src/__tests__/schema/index.test.ts"]],
  ["SQL/ParserTest.php", ["src/__tests__/sql/sql-parser.test.ts"]],
  ["Driver/PgSQL/DriverTest.php", ["src/__tests__/driver/pg-driver.test.ts"]],
  ["Driver/SQLSrv/DriverTest.php", ["src/__tests__/driver/mssql-driver.test.ts"]],
]);

const doctrineFiles = walkFiles(doctrineTestsDir, (filePath) => filePath.endsWith(".php"))
  .map((filePath) => toPosix(path.relative(doctrineTestsDir, filePath)))
  .sort((a, b) => a.localeCompare(b));

const datazenTestFiles = walkFiles(
  datazenTestsDir,
  (filePath) => filePath.endsWith(".test.ts") || filePath.endsWith(".spec.ts"),
)
  .map((filePath) => toPosix(path.relative(rootDir, filePath)))
  .sort((a, b) => a.localeCompare(b));

function expectedPathsFor(relDoctrineFile) {
  const aliases = aliasMap.get(relDoctrineFile);
  if (aliases !== undefined) {
    return aliases;
  }

  const normalizedSegments = doctrineSegments(relDoctrineFile);
  return [`src/__tests__/${normalizedSegments.join("/")}.test.ts`];
}

function fuzzyMatchesFor(relDoctrineFile, expectedPaths) {
  const segments = doctrineSegments(relDoctrineFile);
  const top = segments[0];
  const base = segments.at(-1);
  if (base === undefined) {
    return [];
  }

  const expectedParents = new Set(expectedPaths.map((candidate) => toPosix(path.dirname(candidate))));
  const allowHyphenHeuristic = base.length > 4 && base !== "type";

  return datazenTestFiles.filter((candidate) => {
    if (!candidate.startsWith("src/__tests__/")) {
      return false;
    }

    if (top !== undefined && !candidate.includes(`/__tests__/${top}`) && !candidate.startsWith(`src/__tests__/${top}`)) {
      return false;
    }

    const candidateParent = toPosix(path.dirname(candidate));
    if (!expectedParents.has(candidateParent)) {
      return false;
    }

    const fileBase = path.basename(candidate, ".test.ts");
    if (fileBase === base) {
      return true;
    }

    if (!allowHyphenHeuristic) {
      return false;
    }

    return fileBase.startsWith(`${base}-`) || fileBase.endsWith(`-${base}`);
  });
}

function classify(relDoctrineFile) {
  const exclusion = exclusionRules.find((rule) => rule.match(relDoctrineFile));
  if (exclusion !== undefined) {
    return {
      doctrineFile: relDoctrineFile,
      status: "excluded",
      reason: exclusion.reason,
      expectedPaths: expectedPathsFor(relDoctrineFile),
      matchedPaths: [],
      fuzzyMatches: [],
    };
  }

  const expectedPaths = expectedPathsFor(relDoctrineFile);
  const matchedPaths = expectedPaths.filter((candidate) => datazenTestFiles.includes(candidate));

  if (matchedPaths.length > 0) {
    return {
      doctrineFile: relDoctrineFile,
      status: "matched",
      expectedPaths,
      matchedPaths,
      fuzzyMatches: [],
    };
  }

  const fuzzyMatches = fuzzyMatchesFor(relDoctrineFile, expectedPaths);
  if (fuzzyMatches.length > 0) {
    return {
      doctrineFile: relDoctrineFile,
      status: "fuzzy",
      expectedPaths,
      matchedPaths: [],
      fuzzyMatches,
    };
  }

  return {
    doctrineFile: relDoctrineFile,
    status: "missing",
    expectedPaths,
    matchedPaths: [],
    fuzzyMatches: [],
  };
}

const rows = doctrineFiles.map(classify);

const summary = {
  doctrineFileCount: doctrineFiles.length,
  datazenTestFileCount: datazenTestFiles.length,
  matched: rows.filter((row) => row.status === "matched").length,
  fuzzy: rows.filter((row) => row.status === "fuzzy").length,
  missing: rows.filter((row) => row.status === "missing").length,
  excluded: rows.filter((row) => row.status === "excluded").length,
};

const byTopLevel = {};
for (const row of rows) {
  const topLevel = row.doctrineFile.includes("/") ? row.doctrineFile.split("/")[0] : "(root)";
  byTopLevel[topLevel] ??= { matched: 0, fuzzy: 0, missing: 0, excluded: 0, total: 0 };
  byTopLevel[topLevel].total += 1;
  byTopLevel[topLevel][row.status] += 1;
}

const report = {
  generatedAt: new Date().toISOString(),
  doctrineTestsDir: toPosix(path.relative(rootDir, doctrineTestsDir)),
  datazenTestsDir: toPosix(path.relative(rootDir, datazenTestsDir)),
  summary,
  byTopLevel,
  rows,
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

console.log("Doctrine DBAL Test Parity Report (best effort)");
console.log("");
console.log(
  `Doctrine files: ${summary.doctrineFileCount} | Datazen test files: ${summary.datazenTestFileCount}`,
);
console.log(
  `Matched: ${summary.matched} | Fuzzy: ${summary.fuzzy} | Missing: ${summary.missing} | Excluded: ${summary.excluded}`,
);
console.log("");

console.log("By top-level area:");
for (const key of Object.keys(byTopLevel).sort((a, b) => a.localeCompare(b))) {
  const bucket = byTopLevel[key];
  console.log(
    `- ${key}: total=${bucket.total}, matched=${bucket.matched}, fuzzy=${bucket.fuzzy}, missing=${bucket.missing}, excluded=${bucket.excluded}`,
  );
}

const missingRows = rows.filter((row) => row.status === "missing");
if (missingRows.length > 0) {
  console.log("");
  console.log("Missing (first 50):");
  for (const row of missingRows.slice(0, 50)) {
    console.log(`- ${row.doctrineFile} -> ${row.expectedPaths.join(" | ")}`);
  }
}

const fuzzyRows = rows.filter((row) => row.status === "fuzzy");
if (fuzzyRows.length > 0) {
  console.log("");
  console.log("Fuzzy matches (first 30):");
  for (const row of fuzzyRows.slice(0, 30)) {
    console.log(
      `- ${row.doctrineFile} -> expected ${row.expectedPaths.join(" | ")} ; found ${row.fuzzyMatches.join(", ")}`,
    );
  }
}
