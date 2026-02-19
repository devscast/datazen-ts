import { describe, expect, it } from "vitest";

import { MySQL2Connection } from "../../driver/mysql2/connection";
import { DbalException, InvalidParameterException } from "../../exception/index";

describe("MySQL2Connection", () => {
  it("executes query using execute() and normalizes rows", async () => {
    const client = {
      execute: async () => [[{ id: 1, name: "Alice" }], []],
    };
    const connection = new MySQL2Connection(client, false);

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

  it("falls back to query() when execute() is unavailable", async () => {
    const client = {
      query: async () => [[{ value: 1 }], []],
    };
    const connection = new MySQL2Connection(client, false);

    const result = await connection.executeQuery({
      parameters: [],
      sql: "SELECT 1 AS value",
      types: [],
    });

    expect(result.rows).toEqual([{ value: 1 }]);
  });

  it("normalizes statement metadata", async () => {
    const client = {
      execute: async () => [{ affectedRows: 3, insertId: 99 }],
    };
    const connection = new MySQL2Connection(client, false);

    const result = await connection.executeStatement({
      parameters: [],
      sql: "UPDATE users SET active = 1",
      types: [],
    });

    expect(result).toEqual({ affectedRows: 3, insertId: 99 });
  });

  it("derives affected rows from array results when metadata is missing", async () => {
    const client = {
      query: async () => [[{ id: 1 }, { id: 2 }], []],
    };
    const connection = new MySQL2Connection(client, false);

    const result = await connection.executeStatement({
      parameters: [],
      sql: "SELECT id FROM users",
      types: [],
    });

    expect(result).toEqual({ affectedRows: 2, insertId: null });
  });

  it("rejects named parameter payloads after compilation", async () => {
    const client = {
      query: async () => [[{ id: 1 }], []],
    };
    const connection = new MySQL2Connection(client, false);

    await expect(
      connection.executeQuery({
        parameters: { id: 1 },
        sql: "SELECT id FROM users WHERE id = :id",
        types: {},
      }),
    ).rejects.toThrow(InvalidParameterException);
  });

  it("throws when client has neither execute() nor query()", async () => {
    const connection = new MySQL2Connection({}, false);

    await expect(
      connection.executeQuery({
        parameters: [],
        sql: "SELECT 1",
        types: [],
      }),
    ).rejects.toThrow(DbalException);
  });

  it("begins and commits transactions on acquired pooled connections", async () => {
    const calls = {
      begin: 0,
      commit: 0,
      release: 0,
    };
    const txConnection = {
      beginTransaction: async () => {
        calls.begin += 1;
      },
      commit: async () => {
        calls.commit += 1;
      },
      execute: async () => [[{ value: 1 }], []],
      release: () => {
        calls.release += 1;
      },
    };
    const pool = {
      getConnection: async () => txConnection,
      query: async () => [[{ value: 0 }], []],
    };
    const connection = new MySQL2Connection(pool, false);

    await connection.beginTransaction();
    expect(connection.getNativeConnection()).toBe(txConnection);
    await connection.commit();

    expect(calls.begin).toBe(1);
    expect(calls.commit).toBe(1);
    expect(calls.release).toBe(1);
    expect(connection.getNativeConnection()).toBe(pool);
  });

  it("rolls back active transactions and releases connection", async () => {
    const calls = {
      begin: 0,
      release: 0,
      rollback: 0,
    };
    const txConnection = {
      beginTransaction: async () => {
        calls.begin += 1;
      },
      execute: async () => [[{ value: 1 }], []],
      release: () => {
        calls.release += 1;
      },
      rollback: async () => {
        calls.rollback += 1;
      },
    };
    const pool = {
      getConnection: async () => txConnection,
      query: async () => [[{ value: 0 }], []],
    };
    const connection = new MySQL2Connection(pool, false);

    await connection.beginTransaction();
    await connection.rollBack();

    expect(calls.begin).toBe(1);
    expect(calls.rollback).toBe(1);
    expect(calls.release).toBe(1);
  });

  it("throws for invalid transaction transitions", async () => {
    const connection = new MySQL2Connection({ query: async () => [] }, false);

    await expect(connection.commit()).rejects.toThrow(DbalException);
    await expect(connection.rollBack()).rejects.toThrow(DbalException);
  });

  it("issues savepoint SQL", async () => {
    const capturedSql: string[] = [];
    const connection = new MySQL2Connection(
      {
        query: async (sql: string) => {
          capturedSql.push(sql);
          return [];
        },
      },
      false,
    );

    await connection.createSavepoint("sp1");
    await connection.releaseSavepoint("sp1");
    await connection.rollbackSavepoint("sp1");

    expect(capturedSql).toEqual([
      "SAVEPOINT sp1",
      "RELEASE SAVEPOINT sp1",
      "ROLLBACK TO SAVEPOINT sp1",
    ]);
  });

  it("quotes string values and reads server version", async () => {
    const connection = new MySQL2Connection(
      {
        query: async (sql: string) => {
          if (sql.includes("VERSION")) {
            return [[{ version: 80031 }], []];
          }

          return [];
        },
      },
      false,
    );

    expect(connection.quote("a\\b'c")).toBe("'a\\\\b''c'");
    expect(await connection.getServerVersion()).toBe("80031");
  });

  it("closes owned clients only", async () => {
    const calls = { end: 0 };
    const client = {
      end: async () => {
        calls.end += 1;
      },
      query: async () => [],
    };

    await new MySQL2Connection(client, false).close();
    expect(calls.end).toBe(0);

    await new MySQL2Connection(client, true).close();
    expect(calls.end).toBe(1);
  });
});
