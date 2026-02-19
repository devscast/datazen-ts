import { describe, expect, it } from "vitest";

import { ArrayParameterType } from "../../array-parameter-type";
import { ParameterBindingStyle } from "../../driver";
import {
  InvalidParameterError,
  MissingNamedParameterError,
  MissingPositionalParameterError,
  MixedParameterStyleError,
} from "../../exception/index";
import { ParameterCompiler } from "../../parameter-compiler";
import { ParameterType } from "../../parameter-type";
import { Query } from "../../query";
import type { SQLParser, Visitor } from "../../sql/parser";

describe("ParameterCompiler", () => {
  it("compiles named parameters to positional placeholders", () => {
    const compiler = new ParameterCompiler();
    const result = compiler.compile(
      "SELECT * FROM users WHERE id = :id AND status = :status",
      { id: 10, status: "active" },
      { id: ParameterType.INTEGER, status: ParameterType.STRING },
      ParameterBindingStyle.POSITIONAL,
    );

    expect(result.sql).toBe("SELECT * FROM users WHERE id = ? AND status = ?");
    expect(result.parameters).toEqual([10, "active"]);
    expect(result.types).toEqual([ParameterType.INTEGER, ParameterType.STRING]);
  });

  it("expands array parameters", () => {
    const compiler = new ParameterCompiler();
    const result = compiler.compile(
      "SELECT * FROM users WHERE id IN (:ids)",
      { ids: [1, 2, 3] },
      { ids: ArrayParameterType.INTEGER },
      ParameterBindingStyle.POSITIONAL,
    );

    expect(result.sql).toBe("SELECT * FROM users WHERE id IN (?, ?, ?)");
    expect(result.parameters).toEqual([1, 2, 3]);
    expect(result.types).toEqual([
      ParameterType.INTEGER,
      ParameterType.INTEGER,
      ParameterType.INTEGER,
    ]);
  });

  it("compiles to SQL Server named placeholders", () => {
    const compiler = new ParameterCompiler();
    const result = compiler.compile(
      "SELECT * FROM users WHERE id = :id",
      { id: 99 },
      { id: ParameterType.INTEGER },
      ParameterBindingStyle.NAMED,
    );

    expect(result.sql).toBe("SELECT * FROM users WHERE id = @p1");
    expect(result.parameters).toEqual({ p1: 99 });
    expect(result.types).toEqual({ p1: ParameterType.INTEGER });
  });

  it("does not parse placeholders inside string literals", () => {
    const compiler = new ParameterCompiler();
    const result = compiler.compile(
      "SELECT ':not_a_param' AS value, col FROM users WHERE id = :id",
      { id: 1 },
      { id: ParameterType.INTEGER },
      ParameterBindingStyle.POSITIONAL,
    );

    expect(result.sql).toBe("SELECT ':not_a_param' AS value, col FROM users WHERE id = ?");
    expect(result.parameters).toEqual([1]);
  });

  it("does not parse placeholders inside one-line comments", () => {
    const compiler = new ParameterCompiler();
    const result = compiler.compile(
      "SELECT 1 -- :ignored ? \nFROM users WHERE id = :id",
      { id: 7 },
      { id: ParameterType.INTEGER },
      ParameterBindingStyle.POSITIONAL,
    );

    expect(result.sql).toBe("SELECT 1 -- :ignored ? \nFROM users WHERE id = ?");
    expect(result.parameters).toEqual([7]);
  });

  it("does not parse placeholders inside multi-line comments", () => {
    const compiler = new ParameterCompiler();
    const result = compiler.compile(
      "SELECT /* :ignored ? */ id FROM users WHERE status = :status",
      { status: "active" },
      { status: ParameterType.STRING },
      ParameterBindingStyle.POSITIONAL,
    );

    expect(result.sql).toBe("SELECT /* :ignored ? */ id FROM users WHERE status = ?");
    expect(result.parameters).toEqual(["active"]);
  });

  it("preserves PostgreSQL-style cast operators while compiling parameters", () => {
    const compiler = new ParameterCompiler();
    const result = compiler.compile(
      "SELECT :value::int AS val",
      { value: "10" },
      { value: ParameterType.STRING },
      ParameterBindingStyle.POSITIONAL,
    );

    expect(result.sql).toBe("SELECT ?::int AS val");
    expect(result.parameters).toEqual(["10"]);
  });

  it("preserves repeated colon tokens", () => {
    const compiler = new ParameterCompiler();
    const result = compiler.compile(
      "SELECT :::operator, :value AS v",
      { value: 42 },
      { value: ParameterType.INTEGER },
      ParameterBindingStyle.POSITIONAL,
    );

    expect(result.sql).toBe("SELECT :::operator, ? AS v");
    expect(result.parameters).toEqual([42]);
  });

  it("does not treat ?? as positional placeholders", () => {
    const compiler = new ParameterCompiler();
    const result = compiler.compile(
      "SELECT ?? AS json_op, ? AS id",
      [10],
      [ParameterType.INTEGER],
      ParameterBindingStyle.POSITIONAL,
    );

    expect(result.sql).toBe("SELECT ?? AS json_op, ? AS id");
    expect(result.parameters).toEqual([10]);
  });

  it("throws when named and positional parameter styles are mixed in one statement", () => {
    const compiler = new ParameterCompiler();

    expect(() =>
      compiler.compile(
        "SELECT * FROM users WHERE id = :id AND email = ?",
        { id: 1 },
        { id: ParameterType.INTEGER },
        ParameterBindingStyle.POSITIONAL,
      ),
    ).toThrow(MixedParameterStyleError);
  });

  it("throws for missing named parameters", () => {
    const compiler = new ParameterCompiler();

    expect(() =>
      compiler.compile(
        "SELECT * FROM users WHERE id = :id",
        {},
        {},
        ParameterBindingStyle.POSITIONAL,
      ),
    ).toThrow(MissingNamedParameterError);
  });

  it("throws for missing positional parameters", () => {
    const compiler = new ParameterCompiler();

    expect(() =>
      compiler.compile(
        "SELECT * FROM users WHERE id = ?",
        [],
        [],
        ParameterBindingStyle.POSITIONAL,
      ),
    ).toThrow(MissingPositionalParameterError);
  });

  it("throws when array values are used without array parameter types", () => {
    const compiler = new ParameterCompiler();

    expect(() =>
      compiler.compile(
        "SELECT * FROM users WHERE id IN (:ids)",
        { ids: [1, 2, 3] },
        { ids: ParameterType.INTEGER },
        ParameterBindingStyle.POSITIONAL,
      ),
    ).toThrow(InvalidParameterError);
  });

  it("expands empty arrays to NULL without bound values", () => {
    const compiler = new ParameterCompiler();
    const result = compiler.compile(
      "SELECT * FROM users WHERE id IN (:ids)",
      { ids: [] },
      { ids: ArrayParameterType.INTEGER },
      ParameterBindingStyle.POSITIONAL,
    );

    expect(result.sql).toBe("SELECT * FROM users WHERE id IN (NULL)");
    expect(result.parameters).toEqual([]);
    expect(result.types).toEqual([]);
  });

  it("accepts named parameter maps with prefixed keys", () => {
    const compiler = new ParameterCompiler();
    const result = compiler.compile(
      "SELECT * FROM users WHERE id = :id",
      { ":id": 5 },
      { ":id": ParameterType.INTEGER },
      ParameterBindingStyle.POSITIONAL,
    );

    expect(result.sql).toBe("SELECT * FROM users WHERE id = ?");
    expect(result.parameters).toEqual([5]);
    expect(result.types).toEqual([ParameterType.INTEGER]);
  });

  it("duplicates values when the same named placeholder appears multiple times", () => {
    const compiler = new ParameterCompiler();
    const result = compiler.compile(
      "SELECT * FROM users WHERE id = :id OR parent_id = :id",
      { id: 12 },
      { id: ParameterType.INTEGER },
      ParameterBindingStyle.NAMED,
    );

    expect(result.sql).toBe("SELECT * FROM users WHERE id = @p1 OR parent_id = @p2");
    expect(result.parameters).toEqual({ p1: 12, p2: 12 });
    expect(result.types).toEqual({ p1: ParameterType.INTEGER, p2: ParameterType.INTEGER });
  });

  it("compiles from Query objects", () => {
    const compiler = new ParameterCompiler();
    const query = new Query(
      "SELECT * FROM users WHERE id = :id",
      { id: 3 },
      { id: ParameterType.INTEGER },
    );

    const result = compiler.compileFromQuery(query, ParameterBindingStyle.POSITIONAL);
    expect(result.sql).toBe("SELECT * FROM users WHERE id = ?");
    expect(result.parameters).toEqual([3]);
    expect(result.types).toEqual([ParameterType.INTEGER]);
  });

  it("parses placeholders inside ARRAY[] and ignores SQL Server bracket identifiers", () => {
    const compiler = new ParameterCompiler();
    const result = compiler.compile(
      "SELECT ARRAY[:id] AS ids, [col:name] AS col, :status AS status",
      { id: 1, status: "ok" },
      { id: ParameterType.INTEGER, status: ParameterType.STRING },
      ParameterBindingStyle.POSITIONAL,
    );

    expect(result.sql).toBe("SELECT ARRAY[?] AS ids, [col:name] AS col, ? AS status");
    expect(result.parameters).toEqual([1, "ok"]);
    expect(result.types).toEqual([ParameterType.INTEGER, ParameterType.STRING]);
  });

  it("uses the injected SQL parser implementation", () => {
    const parserCalls: string[] = [];
    const fakeParser: SQLParser = {
      parse(sql: string, visitor: Visitor): void {
        parserCalls.push(sql);
        visitor.acceptOther("SELECT ");
        visitor.acceptPositionalParameter("?");
      },
    };

    const compiler = new ParameterCompiler(fakeParser);
    const result = compiler.compile(
      "SELECT :ignored",
      [123],
      [ParameterType.INTEGER],
      ParameterBindingStyle.POSITIONAL,
    );

    expect(parserCalls).toEqual(["SELECT :ignored"]);
    expect(result.sql).toBe("SELECT ?");
    expect(result.parameters).toEqual([123]);
    expect(result.types).toEqual([ParameterType.INTEGER]);
  });
});
