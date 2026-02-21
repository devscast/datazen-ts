import { describe, expect, it } from "vitest";

import { Configuration } from "../../configuration";
import { Connection } from "../../connection";
import {
  type Driver,
  type DriverConnection,
  type DriverExecutionResult,
  type DriverQueryResult,
  ParameterBindingStyle,
} from "../../driver";
import type {
  ExceptionConverter,
  ExceptionConverterContext,
} from "../../driver/api/exception-converter";
import {
  DriverException,
  NestedTransactionsNotSupportedException,
  NoActiveTransactionException,
  RollbackOnlyException,
} from "../../exception/index";
import type { CompiledQuery } from "../../types";

class NoopExceptionConverter implements ExceptionConverter {
  public convert(error: unknown, context: ExceptionConverterContext): DriverException {
    return new DriverException("driver failure", {
      cause: error,
      driverName: "spy",
      operation: context.operation,
      parameters: context.query?.parameters,
      sql: context.query?.sql,
    });
  }
}

interface SavepointSupport {
  create: boolean;
  release: boolean;
  rollback: boolean;
}

class SpyDriverConnection implements DriverConnection {
  public beginCalls = 0;
  public commitCalls = 0;
  public rollbackCalls = 0;
  public closeCalls = 0;
  public createSavepointCalls: string[] = [];
  public releaseSavepointCalls: string[] = [];
  public rollbackSavepointCalls: string[] = [];

  public createSavepoint?: (name: string) => Promise<void>;
  public releaseSavepoint?: (name: string) => Promise<void>;
  public rollbackSavepoint?: (name: string) => Promise<void>;
  public quote?: (value: string) => string;

  constructor(
    savepointSupport: SavepointSupport = { create: true, release: true, rollback: true },
    quote?: (value: string) => string,
  ) {
    if (savepointSupport.create) {
      this.createSavepoint = async (name: string): Promise<void> => {
        this.createSavepointCalls.push(name);
      };
    }

    if (savepointSupport.release) {
      this.releaseSavepoint = async (name: string): Promise<void> => {
        this.releaseSavepointCalls.push(name);
      };
    }

    if (savepointSupport.rollback) {
      this.rollbackSavepoint = async (name: string): Promise<void> => {
        this.rollbackSavepointCalls.push(name);
      };
    }

    if (quote !== undefined) {
      this.quote = quote;
    }
  }

  public async executeQuery(_query: CompiledQuery): Promise<DriverQueryResult> {
    return {
      rowCount: 1,
      rows: [{ value: 1 }],
    };
  }

  public async executeStatement(_query: CompiledQuery): Promise<DriverExecutionResult> {
    return {
      affectedRows: 1,
      insertId: 123,
    };
  }

  public async beginTransaction(): Promise<void> {
    this.beginCalls += 1;
  }

  public async commit(): Promise<void> {
    this.commitCalls += 1;
  }

  public async rollBack(): Promise<void> {
    this.rollbackCalls += 1;
  }

  public async getServerVersion(): Promise<string> {
    return "1.0.0";
  }

  public async close(): Promise<void> {
    this.closeCalls += 1;
  }

  public getNativeConnection(): unknown {
    return this;
  }
}

class MultiColumnDriverConnection extends SpyDriverConnection {
  public override async executeQuery(_query: CompiledQuery): Promise<DriverQueryResult> {
    return {
      rows: [
        { id: "u1", name: "Alice", active: true },
        { id: "u2", name: "Bob", active: false },
      ],
    };
  }
}

class SpyDriver implements Driver {
  public readonly name = "spy";
  public readonly bindingStyle = ParameterBindingStyle.POSITIONAL;
  public connectCalls = 0;
  private readonly exceptionConverter = new NoopExceptionConverter();

  constructor(private readonly connection: DriverConnection) {}

  public async connect(_params: Record<string, unknown>): Promise<DriverConnection> {
    this.connectCalls += 1;
    return this.connection;
  }

  public getExceptionConverter(): ExceptionConverter {
    return this.exceptionConverter;
  }
}

describe("Connection transactions and state", () => {
  it("uses auto-commit enabled by default and can inherit disabled mode from configuration", () => {
    const defaultConnection = new Connection({}, new SpyDriver(new SpyDriverConnection()));
    expect(defaultConnection.isAutoCommit()).toBe(true);

    const nonAutoCommitConnection = new Connection(
      {},
      new SpyDriver(new SpyDriverConnection()),
      new Configuration({ autoCommit: false }),
    );
    expect(nonAutoCommitConnection.isAutoCommit()).toBe(false);
  });

  it("starts a transaction automatically on connect when auto-commit is disabled", async () => {
    const driverConnection = new SpyDriverConnection();
    const connection = new Connection(
      {},
      new SpyDriver(driverConnection),
      new Configuration({ autoCommit: false }),
    );

    await connection.connect();
    expect(connection.isTransactionActive()).toBe(true);
    expect(connection.getTransactionNestingLevel()).toBe(1);
    expect(driverConnection.beginCalls).toBe(1);
  });

  it("starts and commits a root transaction", async () => {
    const driverConnection = new SpyDriverConnection();
    const connection = new Connection({}, new SpyDriver(driverConnection));

    await connection.beginTransaction();
    expect(connection.isTransactionActive()).toBe(true);
    expect(connection.getTransactionNestingLevel()).toBe(1);
    expect(driverConnection.beginCalls).toBe(1);

    await connection.commit();
    expect(connection.isTransactionActive()).toBe(false);
    expect(connection.getTransactionNestingLevel()).toBe(0);
    expect(driverConnection.commitCalls).toBe(1);
  });

  it("creates and releases savepoints for nested commits", async () => {
    const driverConnection = new SpyDriverConnection();
    const connection = new Connection({}, new SpyDriver(driverConnection));

    await connection.beginTransaction();
    await connection.beginTransaction();

    expect(connection.getTransactionNestingLevel()).toBe(2);
    expect(driverConnection.createSavepointCalls).toEqual(["DATAZEN_2"]);

    await connection.commit();

    expect(connection.getTransactionNestingLevel()).toBe(1);
    expect(driverConnection.releaseSavepointCalls).toEqual(["DATAZEN_2"]);
  });

  it("rolls back nested transactions to savepoint", async () => {
    const driverConnection = new SpyDriverConnection();
    const connection = new Connection({}, new SpyDriver(driverConnection));

    await connection.beginTransaction();
    await connection.beginTransaction();

    await connection.rollBack();
    expect(connection.getTransactionNestingLevel()).toBe(1);
    expect(driverConnection.rollbackSavepointCalls).toEqual(["DATAZEN_2"]);

    await connection.rollBack();
    expect(connection.getTransactionNestingLevel()).toBe(0);
    expect(driverConnection.rollbackCalls).toBe(1);
  });

  it("throws when nested transactions are not supported", async () => {
    const driverConnection = new SpyDriverConnection({
      create: false,
      release: false,
      rollback: false,
    });
    const connection = new Connection({}, new SpyDriver(driverConnection));

    await connection.beginTransaction();
    await expect(connection.beginTransaction()).rejects.toThrow(
      NestedTransactionsNotSupportedException,
    );
  });

  it("throws when commit savepoints are not supported", async () => {
    const driverConnection = new SpyDriverConnection({
      create: true,
      release: false,
      rollback: true,
    });
    const connection = new Connection({}, new SpyDriver(driverConnection));

    await connection.beginTransaction();
    await connection.beginTransaction();
    await expect(connection.commit()).rejects.toThrow(NestedTransactionsNotSupportedException);
  });

  it("throws when rollback savepoints are not supported", async () => {
    const driverConnection = new SpyDriverConnection({
      create: true,
      release: true,
      rollback: false,
    });
    const connection = new Connection({}, new SpyDriver(driverConnection));

    await connection.beginTransaction();
    await connection.beginTransaction();
    await expect(connection.rollBack()).rejects.toThrow(NestedTransactionsNotSupportedException);
  });

  it("throws for commit/rollback when there is no active transaction", async () => {
    const connection = new Connection({}, new SpyDriver(new SpyDriverConnection()));

    await expect(connection.commit()).rejects.toThrow(NoActiveTransactionException);
    await expect(connection.rollBack()).rejects.toThrow(NoActiveTransactionException);
  });

  it("supports rollback-only state and blocks commit", async () => {
    const connection = new Connection({}, new SpyDriver(new SpyDriverConnection()));

    await connection.beginTransaction();
    connection.setRollbackOnly();
    expect(connection.isRollbackOnly()).toBe(true);
    await expect(connection.commit()).rejects.toThrow(RollbackOnlyException);
    await connection.rollBack();
  });

  it("throws rollback-only checks when not in a transaction", () => {
    const connection = new Connection({}, new SpyDriver(new SpyDriverConnection()));

    expect(() => connection.setRollbackOnly()).toThrow(NoActiveTransactionException);
    expect(() => connection.isRollbackOnly()).toThrow(NoActiveTransactionException);
  });

  it("commits or rolls back through transactional()", async () => {
    const driverConnection = new SpyDriverConnection();
    const connection = new Connection({}, new SpyDriver(driverConnection));

    const value = await connection.transactional(async () => 7);
    expect(value).toBe(7);
    expect(driverConnection.beginCalls).toBe(1);
    expect(driverConnection.commitCalls).toBe(1);

    await expect(
      connection.transactional(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(driverConnection.rollbackCalls).toBe(1);
  });

  it("restarts the root transaction on commit when auto-commit is disabled", async () => {
    const driverConnection = new SpyDriverConnection();
    const connection = new Connection(
      {},
      new SpyDriver(driverConnection),
      new Configuration({ autoCommit: false }),
    );

    await connection.connect();
    await connection.commit();

    expect(connection.isTransactionActive()).toBe(true);
    expect(connection.getTransactionNestingLevel()).toBe(1);
    expect(driverConnection.commitCalls).toBe(1);
    expect(driverConnection.beginCalls).toBe(2);
  });

  it("does not restart a transaction on nested commit when auto-commit is disabled", async () => {
    const driverConnection = new SpyDriverConnection();
    const connection = new Connection(
      {},
      new SpyDriver(driverConnection),
      new Configuration({ autoCommit: false }),
    );

    await connection.connect();
    await connection.beginTransaction();
    await connection.commit();

    expect(connection.getTransactionNestingLevel()).toBe(1);
    expect(driverConnection.beginCalls).toBe(1);
    expect(driverConnection.releaseSavepointCalls).toEqual(["DATAZEN_2"]);
  });

  it("restarts the root transaction on rollback when auto-commit is disabled", async () => {
    const driverConnection = new SpyDriverConnection();
    const connection = new Connection(
      {},
      new SpyDriver(driverConnection),
      new Configuration({ autoCommit: false }),
    );

    await connection.connect();
    await connection.rollBack();

    expect(connection.isTransactionActive()).toBe(true);
    expect(connection.getTransactionNestingLevel()).toBe(1);
    expect(driverConnection.rollbackCalls).toBe(1);
    expect(driverConnection.beginCalls).toBe(2);
  });

  it("commits active transactions when enabling auto-commit during a transaction", async () => {
    const driverConnection = new SpyDriverConnection();
    const connection = new Connection(
      {},
      new SpyDriver(driverConnection),
      new Configuration({ autoCommit: false }),
    );

    await connection.connect();
    await connection.setAutoCommit(true);

    expect(connection.isAutoCommit()).toBe(true);
    expect(connection.isTransactionActive()).toBe(false);
    expect(connection.getTransactionNestingLevel()).toBe(0);
    expect(driverConnection.commitCalls).toBe(1);
    expect(driverConnection.beginCalls).toBe(1);
  });

  it("commits and starts a new transaction when disabling auto-commit during a transaction", async () => {
    const driverConnection = new SpyDriverConnection();
    const connection = new Connection({}, new SpyDriver(driverConnection));

    await connection.beginTransaction();
    await connection.setAutoCommit(false);

    expect(connection.isAutoCommit()).toBe(false);
    expect(connection.isTransactionActive()).toBe(true);
    expect(connection.getTransactionNestingLevel()).toBe(1);
    expect(driverConnection.commitCalls).toBe(1);
    expect(driverConnection.beginCalls).toBe(2);
  });

  it("tracks last insert id after executeStatement", async () => {
    const connection = new Connection({}, new SpyDriver(new SpyDriverConnection()));

    const affectedRows = await connection.executeStatement("INSERT INTO test (name) VALUES (?)", [
      "A",
    ]);
    expect(affectedRows).toBe(1);
    expect(await connection.lastInsertId()).toBe(123);
  });

  it("uses driver quote when available and fallback otherwise", async () => {
    const withQuote = new Connection(
      {},
      new SpyDriver(new SpyDriverConnection(undefined, (value) => `[${value}]`)),
    );
    const withoutQuote = new Connection({}, new SpyDriver(new SpyDriverConnection()));

    expect(await withQuote.quote("abc")).toBe("[abc]");
    expect(await withoutQuote.quote("O'Reilly")).toBe("'O''Reilly'");
  });

  it("closes and reconnects physical connection", async () => {
    const driverConnection = new SpyDriverConnection();
    const driver = new SpyDriver(driverConnection);
    const connection = new Connection({}, driver);

    await connection.executeQuery("SELECT 1");
    expect(connection.isConnected()).toBe(true);
    expect(driver.connectCalls).toBe(1);

    await connection.close();
    expect(connection.isConnected()).toBe(false);
    expect(driverConnection.closeCalls).toBe(1);

    await connection.executeQuery("SELECT 1");
    expect(driver.connectCalls).toBe(2);
  });

  it("fetches key/value and associative indexed rows", async () => {
    const connection = new Connection({}, new SpyDriver(new MultiColumnDriverConnection()));

    expect(await connection.fetchAllKeyValue("SELECT id, name, active FROM users")).toEqual({
      u1: "Alice",
      u2: "Bob",
    });

    expect(
      await connection.fetchAllAssociativeIndexed("SELECT id, name, active FROM users"),
    ).toEqual({
      u1: { active: true, name: "Alice" },
      u2: { active: false, name: "Bob" },
    });
  });
});
