import { describe, expect, it } from "vitest";

import { Index } from "../../schema/index";
import { IndexType } from "../../schema/index/index-type";
import { UnqualifiedName } from "../../schema/name/unqualified-name";

function createIndex(
  unique = false,
  primary = false,
  options: Record<string, unknown> = {},
): Index {
  return new Index("foo", ["bar", "baz"], unique, primary, [], options);
}

describe("Schema/Index (Doctrine parity, supported scenarios)", () => {
  it("creates a regular index", () => {
    const index = createIndex();

    expect(index.getObjectName()).toEqual(UnqualifiedName.unquoted("foo"));
    expect(index.getColumns()).toEqual(["bar", "baz"]);
    expect(index.isUnique()).toBe(false);
    expect(index.isPrimary()).toBe(false);
  });

  it("creates primary and unique indexes", () => {
    const primary = createIndex(false, true);
    const unique = createIndex(true, false);

    expect(primary.isUnique()).toBe(true);
    expect(primary.isPrimary()).toBe(true);

    expect(unique.isUnique()).toBe(true);
    expect(unique.isPrimary()).toBe(false);
  });

  it("checks fulfillment for regular/unique/primary indexes", () => {
    const regular = createIndex();
    const regular2 = createIndex();
    const unique = createIndex(true, false);
    const unique2 = createIndex(true, false);
    const primary = createIndex(true, true);
    const primary2 = createIndex(true, true);

    expect(regular.isFulfilledBy(regular2)).toBe(true);
    expect(regular.isFulfilledBy(unique)).toBe(true);
    expect(regular.isFulfilledBy(primary)).toBe(true);

    expect(unique.isFulfilledBy(unique2)).toBe(true);
    expect(unique.isFulfilledBy(regular)).toBe(false);

    expect(primary.isFulfilledBy(primary2)).toBe(true);
    expect(primary.isFulfilledBy(unique)).toBe(false);
  });

  it("handles flags and clustered state", () => {
    const index = createIndex();

    expect(index.hasFlag("clustered")).toBe(false);
    expect(index.getFlags()).toEqual([]);

    index.addFlag("clustered");
    expect(index.hasFlag("clustered")).toBe(true);
    expect(index.hasFlag("CLUSTERED")).toBe(true);
    expect(index.getFlags()).toEqual(["clustered"]);
    expect(index.isClustered()).toBe(true);

    index.removeFlag("clustered");
    expect(index.hasFlag("clustered")).toBe(false);
    expect(index.getFlags()).toEqual([]);
    expect(index.isClustered()).toBe(false);
  });

  it("normalizes quoted columns in span and position checks", () => {
    const index = new Index("foo", ["`bar`", "`baz`"]);

    expect(index.spansColumns(["bar", "baz"])).toBe(true);
    expect(index.hasColumnAtPosition("bar", 0)).toBe(true);
    expect(index.hasColumnAtPosition("baz", 1)).toBe(true);
    expect(index.hasColumnAtPosition("bar", 1)).toBe(false);
    expect(index.hasColumnAtPosition("baz", 0)).toBe(false);
  });

  it("supports case-insensitive option access", () => {
    const without = createIndex();
    const withWhere = createIndex(false, false, { where: "name IS NULL" });

    expect(without.hasOption("where")).toBe(false);
    expect(without.getOptions()).toEqual({});

    expect(withWhere.hasOption("where")).toBe(true);
    expect(withWhere.hasOption("WHERE")).toBe(true);
    expect(withWhere.getOption("where")).toBe("name IS NULL");
    expect(withWhere.getOption("WHERE")).toBe("name IS NULL");
    expect(withWhere.getOptions()).toEqual({ where: "name IS NULL" });
  });

  it("infers index types and predicate for supported combinations", () => {
    expect(new Index("i1", ["user_id"]).getType()).toBe(IndexType.REGULAR);
    expect(new Index("i2", ["user_id"], true).getType()).toBe(IndexType.UNIQUE);
    expect(new Index("i3", ["user_id"], false, false, ["fulltext"]).getType()).toBe(
      IndexType.FULLTEXT,
    );
    expect(new Index("i4", ["user_id"], false, false, ["spatial"]).getType()).toBe(
      IndexType.SPATIAL,
    );

    expect(
      new Index("i5", ["user_id"], false, false, [], { where: null }).getPredicate(),
    ).toBeNull();
    expect(
      new Index("i6", ["user_id"], false, false, [], { where: "is_active = 1" }).getPredicate(),
    ).toBe("is_active = 1");
  });

  it("builds indexed columns with length metadata", () => {
    const index = new Index("idx_user_name", ["first_name", "last_name"], false, false, [], {
      lengths: [16],
    });

    const indexedColumns = index.getIndexedColumns();

    expect(indexedColumns).toHaveLength(2);
    expect(indexedColumns[0]?.getColumnName().toString()).toBe("first_name");
    expect(indexedColumns[0]?.getLength()).toBe(16);
    expect(indexedColumns[1]?.getColumnName().toString()).toBe("last_name");
    expect(indexedColumns[1]?.getLength()).toBeNull();
  });

  it.skip(
    "Doctrine deprecation-only and invalid-state index scenarios are tracked but not fully aligned yet",
  );
});
