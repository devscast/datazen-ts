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
import { DriverException, MixedParameterStyleException } from "../../exception/index";
import { ParameterType } from "../../parameter-type";
import type { CompiledQuery } from "../../types";

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

class CaptureConnection implements DriverConnection {
  public latestQuery: CompiledQuery | null = null;

  public async executeQuery(query: CompiledQuery): Promise<DriverQueryResult> {
    this.latestQuery = query;
    return { rows: [] };
  }

  public async executeStatement(_query: CompiledQuery): Promise<DriverExecutionResult> {
    return { affectedRows: 1 };
  }

  public async beginTransaction(): Promise<void> {}
  public async commit(): Promise<void> {}
  public async rollBack(): Promise<void> {}
  public async getServerVersion(): Promise<string> {
    return "1.0.0";
  }
  public async close(): Promise<void> {}
  public getNativeConnection(): unknown {
    return {};
  }
}

class NamedSpyDriver implements Driver {
  public readonly name = "spy";
  public readonly bindingStyle = ParameterBindingStyle.NAMED;
  private readonly converter = new NoopExceptionConverter();

  constructor(private readonly connection: CaptureConnection) {}

  public async connect(_params: Record<string, unknown>): Promise<DriverConnection> {
    return this.connection;
  }

  public getExceptionConverter(): ExceptionConverter {
    return this.converter;
  }
}

describe("Connection parameter compilation", () => {
  it("compiles named placeholders to sqlsrv style named bindings", async () => {
    const capture = new CaptureConnection();
    const connection = new Connection({}, new NamedSpyDriver(capture));

    await connection.executeQuery(
      "SELECT * FROM users WHERE id = :id AND status = :status",
      { id: 10, status: "active" },
      { id: ParameterType.INTEGER, status: ParameterType.STRING },
    );

    expect(capture.latestQuery).toEqual({
      parameters: {
        p1: 10,
        p2: "active",
      },
      sql: "SELECT * FROM users WHERE id = @p1 AND status = @p2",
      types: {
        p1: ParameterType.INTEGER,
        p2: ParameterType.STRING,
      },
    });
  });

  it("compiles positional placeholders to sqlsrv style named bindings", async () => {
    const capture = new CaptureConnection();
    const connection = new Connection({}, new NamedSpyDriver(capture));

    await connection.executeQuery(
      "SELECT * FROM users WHERE id = ? OR parent_id = ?",
      [12, 12],
      [ParameterType.INTEGER, ParameterType.INTEGER],
    );

    expect(capture.latestQuery).toEqual({
      parameters: {
        p1: 12,
        p2: 12,
      },
      sql: "SELECT * FROM users WHERE id = @p1 OR parent_id = @p2",
      types: {
        p1: ParameterType.INTEGER,
        p2: ParameterType.INTEGER,
      },
    });
  });

  it("throws on mixed placeholder styles in the same SQL", async () => {
    const connection = new Connection({}, new NamedSpyDriver(new CaptureConnection()));

    await expect(
      connection.executeQuery(
        "SELECT * FROM users WHERE id = :id AND parent_id = ?",
        { id: 1 },
        { id: ParameterType.INTEGER },
      ),
    ).rejects.toThrow(MixedParameterStyleException);
  });
});
