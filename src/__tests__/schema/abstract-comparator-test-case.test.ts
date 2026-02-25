import { describe, expect, it } from "vitest";

import { Comparator } from "../../schema/comparator";
import { ComparatorConfig } from "../../schema/comparator-config";
import { Schema } from "../../schema/schema";
import { Sequence } from "../../schema/sequence";
import { Table } from "../../schema/table";
import { Types } from "../../types/types";

function createTable(name: string): Table {
  const table = new Table(name);
  table.addColumn("id", Types.INTEGER, { columnDefinition: "INT" });
  return table;
}

describe("Schema AbstractComparatorTestCase parity scaffold", () => {
  it("compares equal schemas as no-op diff", () => {
    const comparator = new Comparator();
    const schemaA = new Schema([createTable("bugdb")]);
    const schemaB = new Schema([createTable("bugdb")]);

    const diff = comparator.compareSchemas(schemaA, schemaB);

    expect(diff.getCreatedTables()).toEqual([]);
    expect(diff.getAlteredTables()).toEqual([]);
    expect(diff.getDroppedTables()).toEqual([]);
  });

  it("detects created and dropped tables", () => {
    const comparator = new Comparator();
    const table = createTable("bugdb");

    expect(
      comparator.compareSchemas(new Schema([]), new Schema([table])).getCreatedTables(),
    ).toEqual([table]);
    expect(
      comparator.compareSchemas(new Schema([table]), new Schema([])).getDroppedTables(),
    ).toEqual([table]);
  });

  it("detects sequence diffs and schema sequence changes", () => {
    const comparator = new Comparator();
    const seq1 = new Sequence("foo");
    const seq2 = new Sequence("foo", 2, 1);

    expect(comparator.diffSequence(seq1, seq2)).toBe(true);

    const oldSchema = new Schema();
    oldSchema.createSequence("foo");
    const newSchema = new Schema();
    newSchema.createSequence("foo").setAllocationSize(20);

    expect(comparator.compareSchemas(oldSchema, newSchema).getAlteredSequences()).toHaveLength(1);
  });

  it("detects added foreign keys in table diffs", () => {
    const oldTable = new Table("foo");
    oldTable.addColumn("fk", Types.INTEGER, { columnDefinition: "INT" });

    const newTable = new Table("foo");
    newTable.addColumn("fk", Types.INTEGER, { columnDefinition: "INT" });
    newTable.addForeignKeyConstraint("bar", ["fk"], ["id"], {}, "fk_bar");

    const diff = new Comparator().compareTables(oldTable, newTable);

    expect(diff).not.toBeNull();
    expect(diff?.getAddedForeignKeys()).toHaveLength(1);
  });

  it("respects comparator config construction surface", () => {
    const comparator = new Comparator(
      new ComparatorConfig({ detectColumnRenames: true, detectIndexRenames: true }),
    );
    const diff = comparator.compareTables(createTable("foo"), createTable("foo"));

    // Adapted parity: local comparator still returns a diff object even when empty.
    expect(diff).not.toBeNull();
    expect(diff?.hasChanges()).toBe(false);
  });

  it.skip(
    "ports the full Doctrine AbstractComparatorTestCase matrix (platform-specific comparator subclasses not implemented in Node port)",
  );
});
