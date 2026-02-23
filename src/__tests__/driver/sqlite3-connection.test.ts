import { describe, expect, it } from "vitest";

import { SQLite3Connection } from "../../driver/sqlite3/connection";
import { DbalException, InvalidParameterException } from "../../exception/index";

class FakeSQLiteDatabase {
  public readonly allCalls: Array<{ parameters: unknown[]; sql: string }> = [];
  public readonly runCalls: Array<{ parameters: unknown[]; sql: string }> = [];
  public readonly execCalls: string[] = [];
  public closeCalls = 0;

  constructor(
    private readonly allHandler: (sql: string, parameters: unknown[]) => unknown[] = () => [],
    private readonly runHandler: (
      sql: string,
      parameters: unknown[],
    ) => { changes?: number; lastID?: number } = () => ({ changes: 0 }),
  ) {}

  public all(
    sql: string,
    parameters: unknown[],
    callback: (error: Error | null, rows?: unknown[]) => void,
  ): void {
    this.allCalls.push({ parameters, sql });
    callback(null, this.allHandler(sql, parameters));
  }

  public run(
    sql: string,
    parameters: unknown[],
    callback?: (this: { changes?: number; lastID?: number }, error: Error | null) => void,
  ): void {
    this.runCalls.push({ parameters, sql });
    const ctx = this.runHandler(sql, parameters);
    callback?.call(ctx, null);
  }

  public exec(sql: string, callback: (error: Error | null) => void): void {
    this.execCalls.push(sql);
    callback(null);
  }

  public close(callback: (error: Error | null) => void): void {
    this.closeCalls += 1;
    callback(null);
  }
}

describe("SQLite3Connection", () => {
  it("executes queries and normalizes rows", async () => {
    const db = new FakeSQLiteDatabase(() => [{ id: 1, name: "Alice" }]);
    const connection = new SQLite3Connection(db, false);

    const result = await connection.executeQuery({
      parameters: [1],
      sql: "SELECT id, name FROM users WHERE id = ?",
      types: [],
    });

    expect(result).toEqual({
      columns: ["id", "name"],
      rowCount: 1,
      rows: [{ id: 1, name: "Alice" }],
    });
  });

  it("executes statements and returns changes/insertId", async () => {
    const db = new FakeSQLiteDatabase(
      () => [],
      () => ({ changes: 2, lastID: 7 }),
    );
    const connection = new SQLite3Connection(db, false);

    const result = await connection.executeStatement({
      parameters: ["active"],
      sql: "UPDATE users SET status = ?",
      types: [],
    });

    expect(result).toEqual({ affectedRows: 2, insertId: 7 });
  });

  it("rejects named parameter payloads after compilation", async () => {
    const connection = new SQLite3Connection(new FakeSQLiteDatabase(), false);

    await expect(
      connection.executeQuery({
        parameters: { id: 1 },
        sql: "SELECT * FROM users WHERE id = :id",
        types: {},
      }),
    ).rejects.toThrow(InvalidParameterException);
  });

  it("supports transactions and savepoints via exec()", async () => {
    const db = new FakeSQLiteDatabase();
    const connection = new SQLite3Connection(db, false);

    await connection.beginTransaction();
    await connection.createSavepoint("sp1");
    await connection.releaseSavepoint("sp1");
    await connection.rollbackSavepoint("sp1");
    await connection.commit();

    expect(db.execCalls).toEqual([
      "BEGIN",
      "SAVEPOINT sp1",
      "RELEASE SAVEPOINT sp1",
      "ROLLBACK TO SAVEPOINT sp1",
      "COMMIT",
    ]);
  });

  it("quotes values and reads sqlite version", async () => {
    const db = new FakeSQLiteDatabase((sql) => {
      if (sql.includes("sqlite_version")) {
        return [{ version: 3.45 }];
      }

      return [];
    });
    const connection = new SQLite3Connection(db, false);

    expect(connection.quote("O'Reilly")).toBe("'O''Reilly'");
    await expect(connection.getServerVersion()).resolves.toBe("3.45");
  });

  it("throws on invalid transaction transitions and closes owned databases", async () => {
    const db = new FakeSQLiteDatabase();
    const connection = new SQLite3Connection(db, true);

    await expect(connection.commit()).rejects.toThrow(DbalException);
    await expect(connection.rollBack()).rejects.toThrow(DbalException);

    await connection.close();
    expect(db.closeCalls).toBe(1);
  });
});
