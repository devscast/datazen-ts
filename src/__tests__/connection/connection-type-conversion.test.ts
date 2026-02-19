import { describe, expect, it } from "vitest";

import { ArrayParameterType } from "../../array-parameter-type";
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
import { DriverException } from "../../exception/driver-exception";
import { ParameterType } from "../../parameter-type";
import { MySQLPlatform } from "../../platforms/mysql-platform";
import type { CompiledQuery } from "../../types";
import { DateType } from "../../types/date-type";
import { Types } from "../../types/types";

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
  public latestStatement: CompiledQuery | null = null;

  public async executeQuery(query: CompiledQuery): Promise<DriverQueryResult> {
    this.latestQuery = query;
    return { rows: [{ ok: true }] };
  }

  public async executeStatement(query: CompiledQuery): Promise<DriverExecutionResult> {
    this.latestStatement = query;
    return { affectedRows: 1, insertId: null };
  }

  public async beginTransaction(): Promise<void> {}
  public async commit(): Promise<void> {}
  public async rollBack(): Promise<void> {}
  public async getServerVersion(): Promise<string> {
    return "1.0.0";
  }
  public async close(): Promise<void> {}
  public getNativeConnection(): unknown {
    return this;
  }
}

class SpyDriver implements Driver {
  public readonly name = "mysql2";
  public readonly bindingStyle = ParameterBindingStyle.POSITIONAL;
  private readonly converter = new NoopExceptionConverter();

  constructor(private readonly connection: CaptureConnection) {}

  public async connect(_params: Record<string, unknown>): Promise<DriverConnection> {
    return this.connection;
  }

  public getExceptionConverter(): ExceptionConverter {
    return this.converter;
  }

  public getDatabasePlatform(): MySQLPlatform {
    return new MySQLPlatform();
  }
}

describe("Connection type conversion", () => {
  it("converts Datazen Type names to driver values and binding types", async () => {
    const capture = new CaptureConnection();
    const connection = new Connection({}, new SpyDriver(capture));
    const now = new Date(2024, 0, 2, 3, 4, 5);

    await connection.executeQuery(
      "SELECT :dt AS dt, :ok AS ok, :tags AS tags",
      { dt: now, ok: true, tags: ["a", "b"] },
      { dt: Types.DATETIME_MUTABLE, ok: Types.BOOLEAN, tags: Types.SIMPLE_ARRAY },
    );

    expect(capture.latestQuery?.sql).toBe("SELECT ? AS dt, ? AS ok, ? AS tags");
    expect(capture.latestQuery?.parameters).toEqual(["2024-01-02 03:04:05", 1, "a,b"]);
    expect(capture.latestQuery?.types).toEqual([
      ParameterType.STRING,
      ParameterType.BOOLEAN,
      ParameterType.STRING,
    ]);
  });

  it("supports Type instances and preserves array parameter expansion", async () => {
    const capture = new CaptureConnection();
    const connection = new Connection({}, new SpyDriver(capture));
    const dateType = new DateType();
    const date = new Date(2024, 0, 2, 0, 0, 0);

    await connection.executeQuery(
      "SELECT :d AS d, :ids AS ids",
      { d: date, ids: [1, 2] },
      { d: dateType, ids: ArrayParameterType.INTEGER },
    );

    expect(capture.latestQuery?.sql).toBe("SELECT ? AS d, ?, ? AS ids");
    expect(capture.latestQuery?.parameters).toEqual(["2024-01-02", 1, 2]);
    expect(capture.latestQuery?.types).toEqual([
      ParameterType.STRING,
      ParameterType.INTEGER,
      ParameterType.INTEGER,
    ]);
  });
});
