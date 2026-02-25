import { beforeAll, describe, expect, it } from "vitest";

import { MySQLPlatform } from "../../platforms/mysql-platform";
import { Column } from "../../schema/column";
import { NamespaceAlreadyExists } from "../../schema/exception/namespace-already-exists";
import { SequenceAlreadyExists } from "../../schema/exception/sequence-already-exists";
import { SequenceDoesNotExist } from "../../schema/exception/sequence-does-not-exist";
import { TableAlreadyExists } from "../../schema/exception/table-already-exists";
import { TableDoesNotExist } from "../../schema/exception/table-does-not-exist";
import { OptionallyQualifiedName } from "../../schema/name/optionally-qualified-name";
import { Schema } from "../../schema/schema";
import { SchemaConfig } from "../../schema/schema-config";
import { Sequence } from "../../schema/sequence";
import { Table } from "../../schema/table";
import { registerBuiltInTypes } from "../../types/register-built-in-types";
import { Types } from "../../types/types";

describe("Schema (Doctrine SchemaTest parity, unified scope)", () => {
  beforeAll(() => {
    registerBuiltInTypes();
  });

  it("adds and retrieves tables", () => {
    const table = createTable("public.foo");
    const schema = new Schema([table]);

    expect(schema.hasTable("public.foo")).toBe(true);
    expect(schema.getTables()).toEqual([table]);
    expect(schema.getTable("public.foo")).toBe(table);
  });

  it("matches tables case-insensitively", () => {
    const table = createTable("Foo");
    const schema = new Schema([table]);

    expect(schema.hasTable("foo")).toBe(true);
    expect(schema.hasTable("FOO")).toBe(true);
    expect(schema.getTable("foo")).toBe(table);
    expect(schema.getTable("FOO")).toBe(table);
  });

  it("throws for unknown table", () => {
    const schema = new Schema();
    expect(() => schema.getTable("unknown")).toThrow(TableDoesNotExist);
  });

  it("throws when the same table is added twice", () => {
    const table = createTable("foo");
    expect(() => new Schema([table, table])).toThrow(TableAlreadyExists);
  });

  it("renames tables", () => {
    const schema = new Schema([createTable("foo")]);

    schema.renameTable("foo", "bar");

    expect(schema.hasTable("foo")).toBe(false);
    expect(schema.hasTable("bar")).toBe(true);
    expect(schema.getTable("bar").getName()).toBe("bar");
  });

  it("drops tables", () => {
    const schema = new Schema([createTable("foo")]);

    schema.dropTable("foo");

    expect(schema.hasTable("foo")).toBe(false);
  });

  it("creates tables and preserves parsed object names", () => {
    const schema = new Schema();

    const table = schema.createTable("foo");

    expect(table.getObjectName()).toEqual(OptionallyQualifiedName.unquoted("foo"));
    expect(schema.hasTable("foo")).toBe(true);
  });

  it("adds and retrieves sequences", () => {
    const sequence = new Sequence("a_seq");
    const schema = new Schema([], [sequence]);

    expect(schema.hasSequence("a_seq")).toBe(true);
    expect(schema.getSequence("a_seq")).toBe(sequence);
    expect(schema.getSequences()).toEqual([sequence]);
  });

  it("matches sequences case-insensitively", () => {
    const sequence = new Sequence("a_Seq");
    const schema = new Schema([], [sequence]);

    expect(schema.hasSequence("a_seq")).toBe(true);
    expect(schema.hasSequence("A_SEQ")).toBe(true);
    expect(schema.getSequence("a_seq")).toBe(sequence);
    expect(schema.getSequence("A_SEQ")).toBe(sequence);
  });

  it("throws for unknown sequence", () => {
    const schema = new Schema();
    expect(() => schema.getSequence("unknown")).toThrow(SequenceDoesNotExist);
  });

  it("creates sequences with allocation and initial values", () => {
    const schema = new Schema();

    const sequence = schema.createSequence("a_seq", 10, 20);

    expect(sequence.getObjectName()).toEqual(OptionallyQualifiedName.unquoted("a_seq"));
    expect(sequence.getAllocationSize()).toBe(10);
    expect(sequence.getInitialValue()).toBe(20);
    expect(schema.hasSequence("a_seq")).toBe(true);
  });

  it("drops sequences", () => {
    const schema = new Schema([], [new Sequence("a_seq")]);

    schema.dropSequence("a_seq");

    expect(schema.hasSequence("a_seq")).toBe(false);
  });

  it("throws when the same sequence is added twice", () => {
    const sequence = new Sequence("a_seq");
    expect(() => new Schema([], [sequence, sequence])).toThrow(SequenceAlreadyExists);
  });

  it("creates and tracks namespaces (case-insensitive lookups)", () => {
    const schema = new Schema([], [], new SchemaConfig().setName("public"));

    expect(schema.hasNamespace("foo")).toBe(false);

    schema.createNamespace("foo");

    expect(schema.hasNamespace("foo")).toBe(true);
    expect(schema.hasNamespace("FOO")).toBe(true);
    expect(schema.getNamespaces()).toEqual(["foo"]);
  });

  it("throws on duplicate namespace creation", () => {
    const schema = new Schema();
    schema.createNamespace("foo");

    expect(() => schema.createNamespace("foo")).toThrow(NamespaceAlreadyExists);
  });

  it("respects explicit schema name and basic SQL generation helpers", () => {
    const schema = new Schema([], [], new SchemaConfig().setName("app"));
    const table = schema.createTable("users");
    table.addColumn("id", Types.INTEGER);
    table.setPrimaryKey(["id"]);

    expect(schema.getName()).toBe("app");

    const sql = schema.toSql(new MySQLPlatform());
    expect(sql.some((statement) => statement.includes("CREATE TABLE users"))).toBe(true);
  });

  it.skip(
    "supports quoted table lookup aliases like `hasTable('`foo`')` (not implemented in this Node port)",
  );

  it.skip(
    "creates namespaces implicitly when adding qualified tables/sequences (Doctrine behavior not implemented in this Node port)",
  );

  it.skip(
    "covers Doctrine deprecation matrix for qualified/unqualified name ambiguity and default namespace rules (PHP deprecation harness specific)",
  );

  it.skip(
    "covers deep-clone semantics for schema graphs (PHP clone semantics differ from JS/Node)",
  );

  it.skip(
    "enforces max identifier length on auto-generated table indexes via SchemaConfig exactly like Doctrine (not yet aligned in this Node port)",
  );
});

function createTable(name: string): Table {
  return Table.editor()
    .setName(name)
    .setColumns(Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create())
    .create();
}
