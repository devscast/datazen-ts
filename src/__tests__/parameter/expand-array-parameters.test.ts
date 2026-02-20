import { describe, expect, it } from "vitest";

import { ArrayParameterType } from "../../array-parameter-type";
import {
  InvalidParameterException,
  MissingNamedParameterException,
  MissingPositionalParameterException,
  MixedParameterStyleException,
} from "../../exception/index";
import { ExpandArrayParameters } from "../../expand-array-parameters";
import { ParameterType } from "../../parameter-type";
import { Parser } from "../../sql/parser";
import type { QueryParameterTypes, QueryParameters } from "../../types";

function expand(
  sql: string,
  parameters: QueryParameters,
  types: QueryParameterTypes,
): {
  parameters: unknown[];
  sql: string;
  types: unknown[];
} {
  const visitor = new ExpandArrayParameters(parameters, types);
  new Parser(true).parse(sql, visitor);

  return {
    parameters: visitor.getParameters(),
    sql: visitor.getSQL(),
    types: visitor.getTypes(),
  };
}

describe("ExpandArrayParameters", () => {
  it("expands named parameters to positional placeholders", () => {
    const result = expand(
      "SELECT * FROM users WHERE id = :id AND status = :status",
      { id: 10, status: "active" },
      { id: ParameterType.INTEGER, status: ParameterType.STRING },
    );

    expect(result.sql).toBe("SELECT * FROM users WHERE id = ? AND status = ?");
    expect(result.parameters).toEqual([10, "active"]);
    expect(result.types).toEqual([ParameterType.INTEGER, ParameterType.STRING]);
  });

  it("expands array parameters", () => {
    const result = expand(
      "SELECT * FROM users WHERE id IN (:ids)",
      { ids: [1, 2, 3] },
      { ids: ArrayParameterType.INTEGER },
    );

    expect(result.sql).toBe("SELECT * FROM users WHERE id IN (?, ?, ?)");
    expect(result.parameters).toEqual([1, 2, 3]);
    expect(result.types).toEqual([
      ParameterType.INTEGER,
      ParameterType.INTEGER,
      ParameterType.INTEGER,
    ]);
  });

  it("does not parse placeholders inside string literals", () => {
    const result = expand(
      "SELECT ':not_a_param' AS value, col FROM users WHERE id = :id",
      { id: 1 },
      { id: ParameterType.INTEGER },
    );

    expect(result.sql).toBe("SELECT ':not_a_param' AS value, col FROM users WHERE id = ?");
    expect(result.parameters).toEqual([1]);
  });

  it("does not parse placeholders inside comments", () => {
    const oneLine = expand(
      "SELECT 1 -- :ignored ? \nFROM users WHERE id = :id",
      { id: 7 },
      { id: ParameterType.INTEGER },
    );
    const multiLine = expand(
      "SELECT /* :ignored ? */ id FROM users WHERE status = :status",
      { status: "active" },
      { status: ParameterType.STRING },
    );

    expect(oneLine.sql).toBe("SELECT 1 -- :ignored ? \nFROM users WHERE id = ?");
    expect(oneLine.parameters).toEqual([7]);
    expect(multiLine.sql).toBe("SELECT /* :ignored ? */ id FROM users WHERE status = ?");
    expect(multiLine.parameters).toEqual(["active"]);
  });

  it("preserves postgres cast operators and repeated colon tokens", () => {
    const cast = expand(
      "SELECT :value::int AS val",
      { value: "10" },
      { value: ParameterType.STRING },
    );
    const repeated = expand(
      "SELECT :::operator, :value AS v",
      { value: 42 },
      { value: ParameterType.INTEGER },
    );

    expect(cast.sql).toBe("SELECT ?::int AS val");
    expect(cast.parameters).toEqual(["10"]);
    expect(repeated.sql).toBe("SELECT :::operator, ? AS v");
    expect(repeated.parameters).toEqual([42]);
  });

  it("does not treat ?? as positional placeholders", () => {
    const result = expand("SELECT ?? AS json_op, ? AS id", [10], [ParameterType.INTEGER]);

    expect(result.sql).toBe("SELECT ?? AS json_op, ? AS id");
    expect(result.parameters).toEqual([10]);
  });

  it("throws when named and positional parameter styles are mixed", () => {
    expect(() =>
      expand(
        "SELECT * FROM users WHERE id = :id AND email = ?",
        { id: 1 },
        { id: ParameterType.INTEGER },
      ),
    ).toThrow(MixedParameterStyleException);
  });

  it("throws for missing named parameters", () => {
    expect(() => expand("SELECT * FROM users WHERE id = :id", {}, {})).toThrow(
      MissingNamedParameterException,
    );
  });

  it("throws for missing positional parameters", () => {
    expect(() => expand("SELECT * FROM users WHERE id = ?", [], [])).toThrow(
      MissingPositionalParameterException,
    );
  });

  it("throws when array values are used without array parameter types", () => {
    expect(() =>
      expand(
        "SELECT * FROM users WHERE id IN (:ids)",
        { ids: [1, 2, 3] },
        { ids: ParameterType.INTEGER },
      ),
    ).toThrow(InvalidParameterException);
  });

  it("expands empty arrays to NULL without bound values", () => {
    const result = expand(
      "SELECT * FROM users WHERE id IN (:ids)",
      { ids: [] },
      { ids: ArrayParameterType.INTEGER },
    );

    expect(result.sql).toBe("SELECT * FROM users WHERE id IN (NULL)");
    expect(result.parameters).toEqual([]);
    expect(result.types).toEqual([]);
  });

  it("accepts named parameter maps with prefixed keys", () => {
    const result = expand(
      "SELECT * FROM users WHERE id = :id",
      { ":id": 5 },
      { ":id": ParameterType.INTEGER },
    );

    expect(result.sql).toBe("SELECT * FROM users WHERE id = ?");
    expect(result.parameters).toEqual([5]);
    expect(result.types).toEqual([ParameterType.INTEGER]);
  });

  it("duplicates values when the same named placeholder appears multiple times", () => {
    const result = expand(
      "SELECT * FROM users WHERE id = :id OR parent_id = :id",
      { id: 12 },
      { id: ParameterType.INTEGER },
    );

    expect(result.sql).toBe("SELECT * FROM users WHERE id = ? OR parent_id = ?");
    expect(result.parameters).toEqual([12, 12]);
    expect(result.types).toEqual([ParameterType.INTEGER, ParameterType.INTEGER]);
  });

  it("parses placeholders inside ARRAY[] and ignores bracket identifiers", () => {
    const result = expand(
      "SELECT ARRAY[:id] AS ids, [col:name] AS col, :status AS status",
      { id: 1, status: "ok" },
      { id: ParameterType.INTEGER, status: ParameterType.STRING },
    );

    expect(result.sql).toBe("SELECT ARRAY[?] AS ids, [col:name] AS col, ? AS status");
    expect(result.parameters).toEqual([1, "ok"]);
    expect(result.types).toEqual([ParameterType.INTEGER, ParameterType.STRING]);
  });
});
