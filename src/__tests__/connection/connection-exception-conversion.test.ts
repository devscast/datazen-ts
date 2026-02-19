import { describe, expect, it } from "vitest";

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
import { ConnectionError, DbalError, DriverError } from "../../exception/index";
import type { CompiledQuery } from "../../types";

class SpyExceptionConverter implements ExceptionConverter {
  public lastContext: ExceptionConverterContext | undefined;
  public lastError: unknown;

  public convert(error: unknown, context: ExceptionConverterContext): DriverError {
    this.lastError = error;
    this.lastContext = context;

    return new DriverError("converted", {
      cause: error,
      code: "TEST_CODE",
      driverName: "spy",
      operation: context.operation,
      parameters: context.query?.parameters,
      sql: context.query?.sql,
      sqlState: "HY000",
    });
  }
}

class ThrowingConnection implements DriverConnection {
  public async executeQuery(_query: CompiledQuery): Promise<DriverQueryResult> {
    throw new Error("driver query failure");
  }

  public async executeStatement(_query: CompiledQuery): Promise<DriverExecutionResult> {
    throw new Error("driver statement failure");
  }

  public async beginTransaction(): Promise<void> {
    throw new Error("driver transaction failure");
  }

  public async commit(): Promise<void> {
    throw new Error("driver commit failure");
  }

  public async rollBack(): Promise<void> {
    throw new Error("driver rollback failure");
  }

  public async getServerVersion(): Promise<string> {
    throw new Error("driver version failure");
  }

  public async close(): Promise<void> {}

  public getNativeConnection(): unknown {
    return {};
  }
}

class PassThroughConnection implements DriverConnection {
  public async executeQuery(_query: CompiledQuery): Promise<DriverQueryResult> {
    throw new DbalError("already normalized");
  }

  public async executeStatement(_query: CompiledQuery): Promise<DriverExecutionResult> {
    throw new DbalError("already normalized");
  }

  public async beginTransaction(): Promise<void> {
    throw new DbalError("already normalized");
  }

  public async commit(): Promise<void> {
    throw new DbalError("already normalized");
  }

  public async rollBack(): Promise<void> {
    throw new DbalError("already normalized");
  }

  public async getServerVersion(): Promise<string> {
    throw new DbalError("already normalized");
  }

  public async close(): Promise<void> {}

  public getNativeConnection(): unknown {
    return {};
  }
}

class SpyDriver implements Driver {
  public readonly name = "spy";
  public readonly bindingStyle = ParameterBindingStyle.POSITIONAL;

  constructor(
    private readonly connection: DriverConnection,
    private readonly converter: ExceptionConverter = new SpyExceptionConverter(),
  ) {}

  public async connect(_params: Record<string, unknown>): Promise<DriverConnection> {
    return this.connection;
  }

  public getExceptionConverter(): ExceptionConverter {
    return this.converter;
  }
}

describe("Connection exception conversion", () => {
  it("converts driver errors during executeStatement with query context", async () => {
    const converter = new SpyExceptionConverter();
    const connection = new Connection({}, new SpyDriver(new ThrowingConnection(), converter));

    await expect(
      connection.executeStatement("UPDATE users SET active = ? WHERE id = ?", [true, 1]),
    ).rejects.toBeInstanceOf(DriverError);

    expect(converter.lastContext?.operation).toBe("executeStatement");
    expect(converter.lastContext?.query?.sql).toBe("UPDATE users SET active = ? WHERE id = ?");
    expect(converter.lastContext?.query?.parameters).toEqual([true, 1]);
    expect(converter.lastError).toBeInstanceOf(Error);
  });

  it("does not reconvert already normalized DBAL errors", async () => {
    const connection = new Connection({}, new SpyDriver(new PassThroughConnection()));

    await expect(connection.executeQuery("SELECT 1")).rejects.toBeInstanceOf(DbalError);
    await expect(connection.executeQuery("SELECT 1")).rejects.not.toBeInstanceOf(ConnectionError);
  });
});
