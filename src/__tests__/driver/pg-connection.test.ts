import { describe, expect, it } from "vitest";

import { PgConnection } from "../../driver/pg/connection";
import type { PgQueryResultLike } from "../../driver/pg/types";
import { DbalException, InvalidParameterException } from "../../exception/index";

interface LoggedCall {
  parameters?: unknown[];
  sql: string;
}

class FakePgClient {
  public readonly calls: LoggedCall[] = [];
  public released = 0;

  constructor(
    private readonly handler: (sql: string, parameters?: unknown[]) => Promise<PgQueryResultLike>,
  ) {}

  public async query(sql: string, parameters?: unknown[]): Promise<PgQueryResultLike> {
    this.calls.push({ parameters, sql });
    return this.handler(sql, parameters);
  }

  public release(): void {
    this.released += 1;
  }
}

class FakePgPool {
  public readonly calls: LoggedCall[] = [];
  public endCalls = 0;

  constructor(
    private readonly handler: (sql: string, parameters?: unknown[]) => Promise<PgQueryResultLike>,
    private readonly txClient: FakePgClient,
  ) {}

  public async query(sql: string, parameters?: unknown[]): Promise<PgQueryResultLike> {
    this.calls.push({ parameters, sql });
    return this.handler(sql, parameters);
  }

  public async connect(): Promise<FakePgClient> {
    return this.txClient;
  }

  public async end(): Promise<void> {
    this.endCalls += 1;
  }
}

describe("PgConnection", () => {
  it("rewrites positional placeholders and normalizes query results", async () => {
    const connection = new PgConnection(
      new FakePgClient(async (_sql, _params) => ({
        fields: [{ name: "id" }, { name: "name" }],
        rowCount: 1,
        rows: [{ id: 1, name: "Alice" }],
      })),
      false,
    );

    const result = await connection.executeQuery({
      parameters: [1, "active"],
      sql: "SELECT id, name FROM users WHERE id = ? AND status = ?",
      types: [],
    });

    expect(result).toEqual({
      columns: ["id", "name"],
      rowCount: 1,
      rows: [{ id: 1, name: "Alice" }],
    });
    const native = connection.getNativeConnection() as FakePgClient;
    expect(native.calls[0]).toEqual({
      parameters: [1, "active"],
      sql: "SELECT id, name FROM users WHERE id = $1 AND status = $2",
    });
  });

  it("rejects named parameter payloads after compilation", async () => {
    const connection = new PgConnection(new FakePgClient(async () => ({ rows: [] })), false);

    await expect(
      connection.executeQuery({
        parameters: { id: 1 },
        sql: "SELECT * FROM users WHERE id = :id",
        types: {},
      }),
    ).rejects.toThrow(InvalidParameterException);
  });

  it("uses a dedicated pooled client for transactions and releases it", async () => {
    const txClient = new FakePgClient(async () => ({ rowCount: 0, rows: [] }));
    const pool = new FakePgPool(async () => ({ rowCount: 0, rows: [] }), txClient);
    const connection = new PgConnection(pool, false);

    await connection.beginTransaction();
    await connection.executeStatement({
      parameters: [1],
      sql: "UPDATE users SET active = ?",
      types: [],
    });
    await connection.commit();

    expect(txClient.calls.map((call) => call.sql)).toEqual([
      "BEGIN",
      "UPDATE users SET active = $1",
      "COMMIT",
    ]);
    expect(txClient.released).toBe(1);
  });

  it("supports savepoints, quoting and server version lookup", async () => {
    const client = new FakePgClient(async (sql) => {
      if (sql === "SHOW server_version") {
        return { rows: [{ server_version: "16.2" }] };
      }

      return { rowCount: 0, rows: [] };
    });
    const connection = new PgConnection(client, false);

    await connection.createSavepoint("sp1");
    await connection.releaseSavepoint("sp1");
    await connection.rollbackSavepoint("sp1");

    expect(client.calls.slice(0, 3).map((call) => call.sql)).toEqual([
      "SAVEPOINT sp1",
      "RELEASE SAVEPOINT sp1",
      "ROLLBACK TO SAVEPOINT sp1",
    ]);
    expect(connection.quote("O'Reilly")).toBe("'O''Reilly'");
    await expect(connection.getServerVersion()).resolves.toBe("16.2");
  });

  it("throws on invalid transaction transitions", async () => {
    const connection = new PgConnection(
      new FakePgClient(async () => ({ rowCount: 0, rows: [] })),
      false,
    );

    await expect(connection.commit()).rejects.toThrow(DbalException);
    await expect(connection.rollBack()).rejects.toThrow(DbalException);
  });
});
