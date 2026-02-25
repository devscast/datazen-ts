import { beforeEach, describe, expect, it } from "vitest";

import type { Connection } from "../../connection";
import { Column } from "../../schema/column";
import { Table } from "../../schema/table";
import { Types } from "../../types/types";
import { useFunctionalTestCase } from "./_helpers/functional-test-case";

describe("Functional/StatementTest", () => {
  const functional = useFunctionalTestCase();
  let connection: Connection;

  beforeEach(async () => {
    connection = functional.connection();
    await resetStmtTestTable(functional);
  });

  it("reuses a statement after freeing the result", async () => {
    await connection.insert("stmt_test", { id: 1 });
    await connection.insert("stmt_test", { id: 2 });

    const stmt = await connection.prepare("SELECT id FROM stmt_test ORDER BY id");

    let result = await stmt.executeQuery();
    expect(result.fetchOne()).toBe(1);

    result.free();

    result = await stmt.executeQuery();
    expect(result.fetchOne()).toBe(1);
    expect(result.fetchOne()).toBe(2);
  });

  it("reuses a statement when later results contain longer values", async () => {
    await functional.dropAndCreateTable(
      Table.editor()
        .setUnquotedName("stmt_longer_results")
        .setColumns(
          Column.editor().setUnquotedName("param").setTypeName(Types.STRING).setLength(24).create(),
          Column.editor().setUnquotedName("val").setTypeName(Types.TEXT).create(),
        )
        .create(),
    );

    await connection.insert("stmt_longer_results", { param: "param1", val: "X" });

    const stmt = await connection.prepare(
      "SELECT param, val FROM stmt_longer_results ORDER BY param",
    );

    let result = await stmt.executeQuery();
    expect(result.fetchAllNumeric()).toEqual([["param1", "X"]]);

    await connection.insert("stmt_longer_results", {
      param: "param2",
      val: "A bit longer value",
    });

    result = await stmt.executeQuery();
    expect(result.fetchAllNumeric()).toEqual([
      ["param1", "X"],
      ["param2", "A bit longer value"],
    ]);
  });

  it("does not block the connection when a previous result was not fully fetched", async () => {
    await connection.insert("stmt_test", { id: 1 });
    await connection.insert("stmt_test", { id: 2 });

    const stmt = await connection.prepare("SELECT id FROM stmt_test ORDER BY id");

    let result = await stmt.executeQuery();
    result.fetchAssociative();

    result = await stmt.executeQuery();
    result.fetchAssociative();

    expect(await connection.fetchOne("SELECT id FROM stmt_test WHERE id = ?", [1])).toBe(1);
  });

  it("reuses a statement after freeing and rebinding a parameter", async () => {
    await connection.insert("stmt_test", { id: 1 });
    await connection.insert("stmt_test", { id: 2 });

    const stmt = await connection.prepare("SELECT id FROM stmt_test WHERE id = ?");
    stmt.bindValue(1, 1);

    let result = await stmt.executeQuery();
    expect(result.fetchOne()).toBe(1);

    result.free();
    stmt.bindValue(1, 2);

    result = await stmt.executeQuery();
    expect(result.fetchOne()).toBe(2);
  });

  it("reuses a statement with a rebound value", async () => {
    await connection.insert("stmt_test", { id: 1 });
    await connection.insert("stmt_test", { id: 2 });

    const stmt = await connection.prepare("SELECT id FROM stmt_test WHERE id = ?");

    stmt.bindValue(1, 1);
    expect((await stmt.executeQuery()).fetchOne()).toBe(1);

    stmt.bindValue(1, 2);
    expect((await stmt.executeQuery()).fetchOne()).toBe(2);
  });

  it("keeps positional parameter binding order by parameter index", async () => {
    const platform = connection.getDatabasePlatform();
    const query = platform.getDummySelectSQL(
      `${platform.getLengthExpression("?")} AS len1, ${platform.getLengthExpression("?")} AS len2`,
    );

    const stmt = await connection.prepare(query);
    stmt.bindValue(2, "banana");
    stmt.bindValue(1, "apple");

    expect((await stmt.executeQuery()).fetchNumeric()).toEqual([5, 6]);
  });

  it("fetches a single column result with fetchOne()", async () => {
    const result = await connection.executeQuery(
      connection.getDatabasePlatform().getDummySelectSQL(),
    );

    expect(result.fetchOne()).toBe(1);
  });

  it("executes query via prepared statement", async () => {
    const stmt = await connection.prepare(connection.getDatabasePlatform().getDummySelectSQL());

    expect((await stmt.executeQuery()).fetchOne()).toBe(1);
  });

  it("executes statements and returns affected rows", async () => {
    await connection.insert("stmt_test", { id: 1 });

    let stmt = await connection.prepare("UPDATE stmt_test SET name = ? WHERE id = 1");
    stmt.bindValue(1, "bar");
    expect(await stmt.executeStatement()).toBe(1);

    stmt = await connection.prepare("UPDATE stmt_test SET name = ? WHERE id = ?");
    stmt.bindValue(1, "foo");
    stmt.bindValue(2, 1);
    expect(await stmt.executeStatement()).toBe(1);
  });

  it.skip("does not report invalid named parameter binding on SQLite3 in Doctrine's native sqlite3 driver", async () => {
    // Doctrine skips this for sqlite3. Datazen's sqlite3 adapter currently rejects named binding earlier.
  });

  it.skip("fetches long BLOB values through Node stream conversion", async () => {
    // Doctrine asserts PHP stream conversion semantics for BLOBs. Datazen returns Node values (Buffer/Uint8Array/string).
  });

  it.skip("surfaces redundant parameter execution errors consistently across drivers", async () => {
    // Doctrine marks this as intentionally driver-dependent. SQLite behavior is adapter/driver-specific.
  });
});

async function resetStmtTestTable(
  functional: ReturnType<typeof useFunctionalTestCase>,
): Promise<void> {
  await functional.dropAndCreateTable(
    Table.editor()
      .setUnquotedName("stmt_test")
      .setColumns(
        Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create(),
        Column.editor().setUnquotedName("name").setTypeName(Types.TEXT).setNotNull(false).create(),
      )
      .create(),
  );
}
