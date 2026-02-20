import { describe, expect, it } from "vitest";

import { Configuration } from "../../configuration";
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
import { DriverManager } from "../../driver-manager";
import { DriverException } from "../../exception/index";
import type { Logger } from "../../logging/logger";
import { Middleware } from "../../logging/middleware";
import { ParameterType } from "../../parameter-type";
import type { CompiledQuery } from "../../types";

interface LogEntry {
  level: "debug" | "error" | "info" | "warn";
  message: string;
  context?: Record<string, unknown>;
}

class RecordingLogger implements Logger {
  public readonly entries: LogEntry[] = [];

  public debug(message: string, context?: Record<string, unknown>): void {
    this.entries.push({ context, level: "debug", message });
  }

  public info(message: string, context?: Record<string, unknown>): void {
    this.entries.push({ context, level: "info", message });
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    this.entries.push({ context, level: "warn", message });
  }

  public error(message: string, context?: Record<string, unknown>): void {
    this.entries.push({ context, level: "error", message });
  }
}

class NoopExceptionConverter implements ExceptionConverter {
  public convert(error: unknown, context: ExceptionConverterContext): DriverException {
    return new DriverException("driver error", {
      cause: error,
      driverName: "spy",
      operation: context.operation,
      parameters: context.query?.parameters,
      sql: context.query?.sql,
    });
  }
}

class SpyConnection implements DriverConnection {
  public readonly executedQueries: CompiledQuery[] = [];
  public readonly executedStatements: CompiledQuery[] = [];
  public readonly releasedSavepoints: string[] = [];
  public readonly rolledBackSavepoints: string[] = [];
  public readonly savepoints: string[] = [];
  public beginCalls = 0;
  public closeCalls = 0;
  public commitCalls = 0;
  public rollBackCalls = 0;

  public async executeQuery(query: CompiledQuery): Promise<DriverQueryResult> {
    this.executedQueries.push(query);
    return { rows: [{ id: 1 }] };
  }

  public async executeStatement(query: CompiledQuery): Promise<DriverExecutionResult> {
    this.executedStatements.push(query);
    return { affectedRows: 1, insertId: 2 };
  }

  public async beginTransaction(): Promise<void> {
    this.beginCalls += 1;
  }

  public async commit(): Promise<void> {
    this.commitCalls += 1;
  }

  public async rollBack(): Promise<void> {
    this.rollBackCalls += 1;
  }

  public async createSavepoint(name: string): Promise<void> {
    this.savepoints.push(name);
  }

  public async releaseSavepoint(name: string): Promise<void> {
    this.releasedSavepoints.push(name);
  }

  public async rollbackSavepoint(name: string): Promise<void> {
    this.rolledBackSavepoints.push(name);
  }

  public quote(value: string): string {
    return `<${value}>`;
  }

  public async getServerVersion(): Promise<string> {
    return "1.2.3";
  }

  public async close(): Promise<void> {
    this.closeCalls += 1;
  }

  public getNativeConnection(): unknown {
    return { connection: "native" };
  }
}

class SpyDriver implements Driver {
  public readonly name = "spy";
  public readonly bindingStyle = ParameterBindingStyle.POSITIONAL;
  public params: Record<string, unknown> | null = null;
  private readonly converter = new NoopExceptionConverter();

  constructor(private readonly connection: SpyConnection) {}

  public async connect(params: Record<string, unknown>): Promise<DriverConnection> {
    this.params = params;
    return this.connection;
  }

  public getExceptionConverter(): ExceptionConverter {
    return this.converter;
  }
}

describe("Logging Middleware", () => {
  it("logs connection parameters and redacts password", async () => {
    const logger = new RecordingLogger();
    const driver = new SpyDriver(new SpyConnection());
    const configuration = new Configuration({
      middlewares: [new Middleware(logger)],
    });
    const connection = DriverManager.getConnection(
      {
        driverInstance: driver,
        password: "123456",
        user: "bernard",
      },
      configuration,
    );

    await connection.getServerVersion();

    expect(driver.params?.password).toBe("123456");

    const connectLog = logger.entries.find(
      (entry) => entry.level === "info" && entry.message === "Connecting with parameters {params}",
    );
    const params = connectLog?.context?.params as Record<string, unknown>;

    expect(params.password).toBe("<redacted>");
    expect(params.user).toBe("bernard");
  });

  it("logs query and statement execution details", async () => {
    const logger = new RecordingLogger();
    const nativeConnection = new SpyConnection();
    const connection = DriverManager.getConnection(
      {
        driverInstance: new SpyDriver(nativeConnection),
      },
      new Configuration({ middlewares: [new Middleware(logger)] }),
    );

    await connection.executeQuery("SELECT :id AS id", { id: 1 }, { id: ParameterType.INTEGER });
    await connection.executeStatement(
      "UPDATE users SET name = :name WHERE id = :id",
      { id: 1, name: "alice" },
      { id: ParameterType.INTEGER, name: ParameterType.STRING },
    );

    expect(nativeConnection.executedQueries[0]).toEqual({
      parameters: [1],
      sql: "SELECT ? AS id",
      types: [ParameterType.INTEGER],
    });
    expect(nativeConnection.executedStatements[0]).toEqual({
      parameters: ["alice", 1],
      sql: "UPDATE users SET name = ? WHERE id = ?",
      types: [ParameterType.STRING, ParameterType.INTEGER],
    });

    const queryLog = logger.entries.find(
      (entry) =>
        entry.level === "debug" &&
        entry.message === "Executing query: {sql} (parameters: {params}, types: {types})",
    );
    expect(queryLog?.context).toEqual({
      params: [1],
      sql: "SELECT ? AS id",
      types: [ParameterType.INTEGER],
    });

    const statementLog = logger.entries.find(
      (entry) =>
        entry.level === "debug" &&
        entry.message === "Executing statement: {sql} (parameters: {params}, types: {types})",
    );
    expect(statementLog?.context).toEqual({
      params: ["alice", 1],
      sql: "UPDATE users SET name = ? WHERE id = ?",
      types: [ParameterType.STRING, ParameterType.INTEGER],
    });
  });

  it("preserves savepoint and quote behavior while logging transactions", async () => {
    const logger = new RecordingLogger();
    const nativeConnection = new SpyConnection();
    const connection = DriverManager.getConnection(
      {
        driverInstance: new SpyDriver(nativeConnection),
      },
      new Configuration({ middlewares: [new Middleware(logger)] }),
    );

    await connection.beginTransaction();
    await connection.beginTransaction();
    await connection.rollBack();
    await connection.commit();

    const quoted = await connection.quote("value");
    await connection.close();

    expect(nativeConnection.beginCalls).toBe(1);
    expect(nativeConnection.commitCalls).toBe(1);
    expect(nativeConnection.rollBackCalls).toBe(0);
    expect(nativeConnection.savepoints).toEqual(["DATAZEN_2"]);
    expect(nativeConnection.rolledBackSavepoints).toEqual(["DATAZEN_2"]);
    expect(nativeConnection.releasedSavepoints).toEqual([]);
    expect(quoted).toBe("<value>");
    expect(nativeConnection.closeCalls).toBe(1);

    expect(logger.entries).toContainEqual({
      context: undefined,
      level: "debug",
      message: "Beginning transaction",
    });
    expect(logger.entries).toContainEqual({
      context: { name: "DATAZEN_2" },
      level: "debug",
      message: "Rolling back savepoint {name}",
    });
    expect(logger.entries).toContainEqual({
      context: undefined,
      level: "debug",
      message: "Committing transaction",
    });
    expect(logger.entries).toContainEqual({
      context: undefined,
      level: "info",
      message: "Disconnecting",
    });
  });
});
