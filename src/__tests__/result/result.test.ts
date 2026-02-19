import { describe, expect, it } from "vitest";

import { NoKeyValueException } from "../../exception/index";
import { Result } from "../../result";

describe("Result", () => {
  it("fetches associative rows sequentially", () => {
    const result = new Result({
      rows: [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ],
    });

    expect(result.fetchAssociative()).toEqual({ id: 1, name: "Alice" });
    expect(result.fetchAssociative()).toEqual({ id: 2, name: "Bob" });
    expect(result.fetchAssociative()).toBe(false);
  });

  it("returns a clone when fetching associative rows", () => {
    const result = new Result({
      rows: [{ id: 1, name: "Alice" }],
    });

    const row = result.fetchAssociative<{ id: number; name: string }>();
    expect(row).toEqual({ id: 1, name: "Alice" });
    if (row !== false) {
      row.name = "Changed";
    }

    expect(result.fetchAssociative()).toBe(false);
  });

  it("fetches numeric rows using explicit column order", () => {
    const result = new Result({
      columns: ["name", "id"],
      rows: [{ id: 7, name: "Carol" }],
    });

    expect(result.fetchNumeric<[string, number]>()).toEqual(["Carol", 7]);
  });

  it("fetches single values and first column values", () => {
    const result = new Result({
      rows: [
        { id: 10, name: "A" },
        { id: 20, name: "B" },
      ],
    });

    expect(result.fetchOne<number>()).toBe(10);
    expect(result.fetchFirstColumn<number>()).toEqual([20]);
  });

  it("fetches all numeric and associative rows", () => {
    const resultForNumeric = new Result({
      rows: [
        { id: 1, name: "A" },
        { id: 2, name: "B" },
      ],
    });

    const resultForAssociative = new Result({
      rows: [
        { id: 1, name: "A" },
        { id: 2, name: "B" },
      ],
    });

    expect(resultForNumeric.fetchAllNumeric<[number, string]>()).toEqual([
      [1, "A"],
      [2, "B"],
    ]);
    expect(resultForAssociative.fetchAllAssociative<{ id: number; name: string }>()).toEqual([
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ]);
  });

  it("fetches key/value pairs", () => {
    const result = new Result({
      rows: [
        { id: "one", value: 100, extra: "x" },
        { id: "two", value: 200, extra: "y" },
      ],
    });

    expect(result.fetchAllKeyValue<number>()).toEqual({
      one: 100,
      two: 200,
    });
  });

  it("throws when key/value fetch has less than two columns", () => {
    const result = new Result({
      rows: [{ id: 1 }],
    });

    expect(() => result.fetchAllKeyValue()).toThrow(NoKeyValueException);
  });

  it("fetches associative rows indexed by first column", () => {
    const result = new Result({
      rows: [
        { id: "u1", name: "Alice", active: true },
        { id: "u2", name: "Bob", active: false },
      ],
    });

    expect(result.fetchAllAssociativeIndexed<{ name: string; active: boolean }>()).toEqual({
      u1: { active: true, name: "Alice" },
      u2: { active: false, name: "Bob" },
    });
  });

  it("supports explicit row and column metadata", () => {
    const result = new Result({
      columns: ["id", "name"],
      rowCount: 42,
      rows: [],
    });

    expect(result.rowCount()).toBe(42);
    expect(result.columnCount()).toBe(2);
    expect(result.getColumnName(0)).toBe("id");
    expect(() => result.getColumnName(2)).toThrow(RangeError);
  });

  it("releases rows when free() is called", () => {
    const result = new Result({
      rows: [{ id: 1 }],
    });

    result.free();
    expect(result.fetchAssociative()).toBe(false);
    expect(result.rowCount()).toBe(0);
  });
});
