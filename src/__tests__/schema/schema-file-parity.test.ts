import { readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function listFiles(root: string, ext: string): string[] {
  const out: string[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const absolutePath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }

      if (entry.isFile() && absolutePath.endsWith(ext)) {
        out.push(path.relative(root, absolutePath));
      }
    }
  };

  walk(root);
  return out.sort();
}

function normalizeAcronyms(input: string): string {
  return input
    .replaceAll("MySQL", "Mysql")
    .replaceAll("PostgreSQL", "PostgreSql")
    .replaceAll("SQLServer", "SqlServer")
    .replaceAll("SQLite", "Sqlite")
    .replaceAll("DB2", "Db2");
}

function toKebab(segment: string): string {
  const normalized = normalizeAcronyms(segment);

  return normalized
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replaceAll("_", "-")
    .toLowerCase();
}

describe("Schema file parity", () => {
  it("covers Doctrine Schema file map with best-effort TS parity", () => {
    const workspaceRoot = process.cwd();
    const referenceRoot = path.join(workspaceRoot, "references/dbal/src/Schema");
    const targetRoot = path.join(workspaceRoot, "src/schema");

    if (!statSync(referenceRoot).isDirectory()) {
      throw new Error("Reference Doctrine schema folder not found.");
    }

    const referenceFiles = listFiles(referenceRoot, ".php").map((relativePath) => {
      const withoutExt = relativePath.slice(0, -4);
      return withoutExt
        .split(path.sep)
        .map((segment) => toKebab(segment))
        .join("/");
    });

    const targetFiles = listFiles(targetRoot, ".ts").map((relativePath) =>
      relativePath.slice(0, -3),
    );

    const missing = referenceFiles.filter((referenceFile) => !targetFiles.includes(referenceFile));

    expect(missing).toEqual([]);
  });
});
