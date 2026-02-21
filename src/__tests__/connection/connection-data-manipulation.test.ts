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
import { DriverException } from "../../exception/index";
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
  public latestStatement: CompiledQuery | null = null;

  public async executeQuery(_query: CompiledQuery): Promise<DriverQueryResult> {
    return { rows: [] };
  }

  public async executeStatement(query: CompiledQuery): Promise<DriverExecutionResult> {
    this.latestStatement = query;
    return { affectedRows: 1, insertId: 1 };
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

class PositionalSpyDriver implements Driver {
  public readonly name = "mysql2";
  public readonly bindingStyle: ParameterBindingStyle = ParameterBindingStyle.POSITIONAL;
  private readonly converter = new NoopExceptionConverter();

  constructor(private readonly connection: CaptureConnection) {}

  public async connect(_params: Record<string, unknown>): Promise<DriverConnection> {
    return this.connection;
  }

  public getExceptionConverter(): ExceptionConverter {
    return this.converter;
  }
}

class NamedSpyDriver extends PositionalSpyDriver {
  public override readonly bindingStyle = ParameterBindingStyle.NAMED;
}

describe("Connection convenience data manipulation methods", () => {
  it("supports empty INSERT payload like Doctrine", async () => {
    const capture = new CaptureConnection();
    const connection = new Connection({}, new PositionalSpyDriver(capture));

    await connection.insert("logs", {});
    expect(capture.latestStatement?.sql).toBe("INSERT INTO logs () VALUES ()");
    expect(capture.latestStatement?.parameters).toEqual([]);
  });

  it("updates with different columns in data and criteria like Doctrine", async () => {
    const capture = new CaptureConnection();
    const connection = new Connection({}, new PositionalSpyDriver(capture));

    await connection.update(
      "TestTable",
      {
        is_edited: true,
        text: "some text",
      },
      {
        id: 1,
        name: "foo",
      },
      {
        id: ParameterType.INTEGER,
        is_edited: ParameterType.BOOLEAN,
        name: ParameterType.STRING,
        text: ParameterType.STRING,
      },
    );

    expect(capture.latestStatement?.sql).toBe(
      "UPDATE TestTable SET is_edited = ?, text = ? WHERE id = ? AND name = ?",
    );
    expect(capture.latestStatement?.parameters).toEqual([true, "some text", 1, "foo"]);
    expect(capture.latestStatement?.types).toEqual([
      ParameterType.BOOLEAN,
      ParameterType.STRING,
      ParameterType.INTEGER,
      ParameterType.STRING,
    ]);
  });

  it("updates with same column in data and criteria like Doctrine", async () => {
    const capture = new CaptureConnection();
    const connection = new Connection({}, new PositionalSpyDriver(capture));

    await connection.update(
      "TestTable",
      {
        is_edited: true,
        text: "some text",
      },
      {
        id: 1,
        is_edited: false,
      },
      {
        id: ParameterType.INTEGER,
        is_edited: ParameterType.BOOLEAN,
        text: ParameterType.STRING,
      },
    );

    expect(capture.latestStatement?.sql).toBe(
      "UPDATE TestTable SET is_edited = ?, text = ? WHERE id = ? AND is_edited = ?",
    );
    expect(capture.latestStatement?.parameters).toEqual([true, "some text", 1, false]);
    expect(capture.latestStatement?.types).toEqual([
      ParameterType.BOOLEAN,
      ParameterType.STRING,
      ParameterType.INTEGER,
      ParameterType.BOOLEAN,
    ]);
  });

  it("updates with IS NULL criteria like Doctrine", async () => {
    const capture = new CaptureConnection();
    const connection = new Connection({}, new PositionalSpyDriver(capture));

    await connection.update(
      "TestTable",
      {
        is_edited: null,
        text: "some text",
      },
      {
        id: null,
        name: "foo",
      },
      {
        id: ParameterType.INTEGER,
        is_edited: ParameterType.BOOLEAN,
        name: ParameterType.STRING,
        text: ParameterType.STRING,
      },
    );

    expect(capture.latestStatement?.sql).toBe(
      "UPDATE TestTable SET is_edited = ?, text = ? WHERE id IS NULL AND name = ?",
    );
    expect(capture.latestStatement?.parameters).toEqual([null, "some text", "foo"]);
    expect(capture.latestStatement?.types).toEqual([
      ParameterType.BOOLEAN,
      ParameterType.STRING,
      ParameterType.STRING,
    ]);
  });

  it("deletes with IS NULL criteria like Doctrine", async () => {
    const capture = new CaptureConnection();
    const connection = new Connection({}, new PositionalSpyDriver(capture));

    await connection.delete(
      "TestTable",
      {
        id: null,
        name: "foo",
      },
      {
        id: ParameterType.INTEGER,
        name: ParameterType.STRING,
      },
    );

    expect(capture.latestStatement?.sql).toBe(
      "DELETE FROM TestTable WHERE id IS NULL AND name = ?",
    );
    expect(capture.latestStatement?.parameters).toEqual(["foo"]);
    expect(capture.latestStatement?.types).toEqual([ParameterType.STRING]);
  });

  it("compiles convenience method statements for named-binding drivers", async () => {
    const capture = new CaptureConnection();
    const connection = new Connection({}, new NamedSpyDriver(capture));

    await connection.update(
      "users",
      { email: "john@example.com" },
      { id: 3 },
      { id: ParameterType.INTEGER },
    );

    expect(capture.latestStatement).toEqual({
      parameters: { p1: "john@example.com", p2: 3 },
      sql: "UPDATE users SET email = @p1 WHERE id = @p2",
      types: { p1: ParameterType.STRING, p2: ParameterType.INTEGER },
    });
  });
});
