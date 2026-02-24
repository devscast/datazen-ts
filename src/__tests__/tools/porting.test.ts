import { describe, expect, it } from "vitest";

import {
  CASE_LOWER,
  CASE_UPPER,
  array_change_key_case,
  array_column,
  array_fill,
  array_key_exists,
  assert,
  is_bool,
  is_boolean,
  is_int,
  is_string,
  key,
  method_exists,
  version_compare,
} from "../../_internal";

describe("porting helpers", () => {
  it("supports basic type guards", () => {
    expect(is_int(1)).toBe(true);
    expect(is_int(1.5)).toBe(false);
    expect(is_string("x")).toBe(true);
    expect(is_string(1)).toBe(false);
    expect(is_boolean(true)).toBe(true);
    expect(is_boolean("true")).toBe(false);
    expect(is_bool(false)).toBe(true);
  });

  it("changes object key case", () => {
    expect(array_change_key_case({ Foo: 1, BAR: 2 }, CASE_LOWER)).toEqual({
      foo: 1,
      bar: 2,
    });

    expect(array_change_key_case({ Foo: 1, bar: 2 }, CASE_UPPER)).toEqual({
      FOO: 1,
      BAR: 2,
    });
  });

  it("returns the first enumerable key", () => {
    expect(key({ alpha: 1, beta: 2 })).toBe("alpha");
    expect(key({ "01": "x" })).toBe("01");

    const sparse: unknown[] = [];
    sparse[2] = "x";
    expect(key(sparse)).toBe(2);

    expect(key([])).toBeNull();
  });

  it("checks array/object key existence (including undefined values)", () => {
    expect(array_key_exists("a", { a: undefined })).toBe(true);
    expect(array_key_exists("b", { a: undefined })).toBe(false);

    const values = ["x"];
    expect(array_key_exists(0, values)).toBe(true);
    expect(array_key_exists(1, values)).toBe(false);
  });

  it("fills values starting at arbitrary indexes", () => {
    expect(array_fill(0, 3, "x")).toEqual(["x", "x", "x"]);

    const offset = array_fill(2, 2, 7);
    expect(offset.length).toBe(4);
    expect(Object.keys(offset)).toEqual(["2", "3"]);
    expect(offset[2]).toBe(7);
    expect(offset[3]).toBe(7);

    const negative = array_fill(-2, 2, "v");
    expect(Object.keys(negative)).toEqual(["-2", "-1"]);
  });

  it("detects methods on instances and prototypes", () => {
    class Example {
      public run(): void {}

      public get computed(): string {
        return "value";
      }
    }

    const instance = new Example() as Example & { ownFn?: () => void };
    instance.ownFn = () => {};

    expect(method_exists(instance, "run")).toBe(true);
    expect(method_exists(instance, "ownFn")).toBe(true);
    expect(method_exists(instance, "computed")).toBe(false);
    expect(method_exists(instance, "missing")).toBe(false);
    expect(method_exists(null, "run")).toBe(false);
  });

  it("extracts columns from object and array rows", () => {
    expect(
      array_column<{ id: number; name: string } | { id: number }>(
        [{ id: 1, name: "a" }, { id: 2 }],
        "name",
      ),
    ).toEqual(["a"]);

    expect(
      array_column(
        [
          { id: 10, name: "alice" },
          { id: 20, name: "bob" },
        ],
        "name",
        "id",
      ),
    ).toEqual({
      "10": "alice",
      "20": "bob",
    });

    expect(
      array_column(
        [
          [11, "a"],
          [12, "b"],
        ],
        1,
        0,
      ),
    ).toEqual({
      "11": "a",
      "12": "b",
    });

    expect(array_column([{ id: 1 }, { id: 2 }], null)).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("throws on failed assert and keeps custom errors", () => {
    expect(() => assert(true)).not.toThrow();
    expect(() => assert(false, "boom")).toThrow("boom");

    const custom = new TypeError("typed");
    expect(() => assert(false, custom)).toThrow(TypeError);
  });

  it("compares versions with numeric and pre-release semantics", () => {
    expect(version_compare("8.0.0", "8.0.0")).toBe(0);
    expect(version_compare("8.0.1", "8.0.0")).toBe(1);
    expect(version_compare("8.0.0", "8.0.1")).toBe(-1);

    expect(version_compare("8.0.0RC1", "8.0.0")).toBe(-1);
    expect(version_compare("8.0.0", "8.0.0pl1")).toBe(-1);
    expect(version_compare("8.0", "8.0.0")).toBe(0);
  });

  it("supports php-style version_compare operators", () => {
    expect(version_compare("8.0.0", "8.0.0RC1", ">")).toBe(true);
    expect(version_compare("8.0.0", "8.0.0", "eq")).toBe(true);
    expect(version_compare("8.0.0", "8.0.1", "lt")).toBe(true);
    expect(version_compare("8.0.1", "8.0.0", "ne")).toBe(true);
    expect(version_compare("8.0.0", "8.0.0", "<>")).toBe(false);
  });
});
