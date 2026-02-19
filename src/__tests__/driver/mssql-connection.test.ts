import { describe, expect, it } from "vitest";

import { MSSQLConnection } from "../../driver/mssql/connection";
import { DbalException, InvalidParameterException } from "../../exception/index";

interface QueryPayload {
  recordset?: Array<Record<string, unknown>>;
  rowsAffected?: number[];
}

class FakeRequest {
  public readonly inputs: Array<{ name: string; value: unknown }> = [];
  public readonly queries: string[] = [];

  constructor(private readonly handler: (sql: string) => Promise<QueryPayload>) {}

  public input(name: string, value: unknown): this {
    this.inputs.push({ name, value });
    return this;
  }

  public async query(sql: string): Promise<QueryPayload> {
    this.queries.push(sql);
    return this.handler(sql);
  }
}

class FakeTransaction {
  public beginCalls = 0;
  public commitCalls = 0;
  public rollbackCalls = 0;
  public readonly requestInstance: FakeRequest;

  constructor(handler: (sql: string) => Promise<QueryPayload>) {
    this.requestInstance = new FakeRequest(handler);
  }

  public async begin(): Promise<void> {
    this.beginCalls += 1;
  }

  public async commit(): Promise<void> {
    this.commitCalls += 1;
  }

  public async rollback(): Promise<void> {
    this.rollbackCalls += 1;
  }

  public request(): FakeRequest {
    return this.requestInstance;
  }
}

class FakePool {
  public closeCalls = 0;
  public readonly requestInstance: FakeRequest;
  public readonly transactionInstance: FakeTransaction;

  constructor(handler: (sql: string) => Promise<QueryPayload>) {
    this.requestInstance = new FakeRequest(handler);
    this.transactionInstance = new FakeTransaction(handler);
  }

  public request(): FakeRequest {
    return this.requestInstance;
  }

  public transaction(): FakeTransaction {
    return this.transactionInstance;
  }

  public async close(): Promise<void> {
    this.closeCalls += 1;
  }
}

describe("MSSQLConnection", () => {
  it("executes named-parameter queries and normalizes row output", async () => {
    const pool = new FakePool(async () => ({
      recordset: [{ id: 1, name: "Alice" }],
      rowsAffected: [1],
    }));
    const connection = new MSSQLConnection(pool, false);

    const result = await connection.executeQuery({
      parameters: { id: 1, status: "active" },
      sql: "SELECT * FROM users WHERE id = @p1 AND status = @p2",
      types: { p1: "INTEGER", p2: "STRING" },
    });

    expect(pool.requestInstance.inputs).toEqual([
      { name: "id", value: 1 },
      { name: "status", value: "active" },
    ]);
    expect(result).toEqual({
      columns: ["id", "name"],
      rowCount: 1,
      rows: [{ id: 1, name: "Alice" }],
    });
  });

  it("normalizes statement affected rows", async () => {
    const pool = new FakePool(async () => ({
      rowsAffected: [2, 3],
    }));
    const connection = new MSSQLConnection(pool, false);

    const result = await connection.executeStatement({
      parameters: { status: "active" },
      sql: "UPDATE users SET status = @status",
      types: { status: "STRING" },
    });

    expect(result).toEqual({ affectedRows: 5, insertId: null });
  });

  it("rejects positional parameters after compilation", async () => {
    const pool = new FakePool(async () => ({
      rowsAffected: [1],
    }));
    const connection = new MSSQLConnection(pool, false);

    await expect(
      connection.executeQuery({
        parameters: [1],
        sql: "SELECT * FROM users WHERE id = ?",
        types: [],
      }),
    ).rejects.toThrow(InvalidParameterException);
  });

  it("serializes requests to respect single-flight behavior", async () => {
    const order: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const firstQueryBarrier = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const pool = new FakePool(async (sql: string) => {
      order.push(`start:${sql}`);
      if (sql === "q1") {
        await firstQueryBarrier;
      }
      order.push(`end:${sql}`);
      return { recordset: [{ sql }], rowsAffected: [1] };
    });
    const connection = new MSSQLConnection(pool, false);

    const first = connection.executeQuery({ parameters: {}, sql: "q1", types: {} });
    const second = connection.executeQuery({ parameters: {}, sql: "q2", types: {} });

    await Promise.resolve();
    expect(order).toEqual(["start:q1"]);

    if (releaseFirst === undefined) {
      throw new Error("Expected first barrier resolver to be initialized.");
    }
    releaseFirst();

    await first;
    await second;
    expect(order).toEqual(["start:q1", "end:q1", "start:q2", "end:q2"]);
  });

  it("uses transaction request context once a transaction begins", async () => {
    const pool = new FakePool(async () => ({
      recordset: [{ v: 1 }],
      rowsAffected: [1],
    }));
    const connection = new MSSQLConnection(pool, false);

    await connection.beginTransaction();
    await connection.executeQuery({
      parameters: { id: 1 },
      sql: "SELECT @id AS v",
      types: { id: "INTEGER" },
    });

    expect(pool.transactionInstance.beginCalls).toBe(1);
    expect(pool.transactionInstance.requestInstance.inputs).toEqual([{ name: "id", value: 1 }]);
    expect(pool.requestInstance.inputs).toEqual([]);

    await connection.commit();
    expect(pool.transactionInstance.commitCalls).toBe(1);
  });

  it("supports rollback and savepoint SQL inside transactions", async () => {
    const pool = new FakePool(async () => ({
      rowsAffected: [1],
    }));
    const connection = new MSSQLConnection(pool, false);

    await connection.beginTransaction();
    await connection.createSavepoint("sp1");
    await connection.rollbackSavepoint("sp1");
    await connection.rollBack();

    expect(pool.transactionInstance.requestInstance.queries).toContain("SAVE TRANSACTION sp1");
    expect(pool.transactionInstance.requestInstance.queries).toContain("ROLLBACK TRANSACTION sp1");
    expect(pool.transactionInstance.rollbackCalls).toBe(1);
  });

  it("throws for savepoint usage outside transactions", async () => {
    const pool = new FakePool(async () => ({ rowsAffected: [1] }));
    const connection = new MSSQLConnection(pool, false);

    await expect(connection.createSavepoint("sp1")).rejects.toThrow(DbalException);
    await expect(connection.rollbackSavepoint("sp1")).rejects.toThrow(DbalException);
  });

  it("quotes values and reads server version", async () => {
    const pool = new FakePool(async (sql: string) => {
      if (sql.includes("@@VERSION")) {
        return { recordset: [{ version: 2019 }] };
      }

      return { rowsAffected: [0] };
    });
    const connection = new MSSQLConnection(pool, false);

    expect(connection.quote("O'Reilly")).toBe("'O''Reilly'");
    expect(await connection.getServerVersion()).toBe("2019");
  });

  it("closes owned pools and rolls back active transactions on close", async () => {
    const pool = new FakePool(async () => ({ rowsAffected: [1] }));
    const connection = new MSSQLConnection(pool, true);

    await connection.beginTransaction();
    await connection.close();

    expect(pool.transactionInstance.rollbackCalls).toBe(1);
    expect(pool.closeCalls).toBe(1);
  });

  it("returns pool as native connection", () => {
    const pool = new FakePool(async () => ({ rowsAffected: [0] }));
    const connection = new MSSQLConnection(pool, false);

    expect(connection.getNativeConnection()).toBe(pool);
  });
});
