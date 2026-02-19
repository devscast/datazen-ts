import { describe, expect, it } from "vitest";

import { Configuration } from "../../configuration";
import {
  type Driver,
  type DriverConnection,
  type DriverExecutionResult,
  type DriverMiddleware,
  type DriverQueryResult,
  ParameterBindingStyle,
} from "../../driver";
import type {
  ExceptionConverter,
  ExceptionConverterContext,
} from "../../driver/api/exception-converter";
import { DriverManager } from "../../driver-manager";
import { DriverError, DriverRequiredError, UnknownDriverError } from "../../exception/index";
import type { CompiledQuery } from "../../types";

class NoopExceptionConverter implements ExceptionConverter {
  public convert(error: unknown, context: ExceptionConverterContext): DriverError {
    return new DriverError("driver error", {
      cause: error,
      driverName: "spy",
      operation: context.operation,
      parameters: context.query?.parameters,
      sql: context.query?.sql,
    });
  }
}

class SpyConnection implements DriverConnection {
  public async executeQuery(_query: CompiledQuery): Promise<DriverQueryResult> {
    return { rows: [] };
  }

  public async executeStatement(_query: CompiledQuery): Promise<DriverExecutionResult> {
    return { affectedRows: 0 };
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

class SpyDriver implements Driver {
  public readonly name = "spy";
  public readonly bindingStyle = ParameterBindingStyle.POSITIONAL;
  public connectCalls = 0;
  private readonly converter = new NoopExceptionConverter();

  public async connect(_params: Record<string, unknown>): Promise<DriverConnection> {
    this.connectCalls += 1;
    return new SpyConnection();
  }

  public getExceptionConverter(): ExceptionConverter {
    return this.converter;
  }
}

class NeverUseDriver implements Driver {
  public readonly name = "never";
  public readonly bindingStyle = ParameterBindingStyle.POSITIONAL;

  public async connect(_params: Record<string, unknown>): Promise<DriverConnection> {
    throw new Error("driverClass should not be used when driverInstance is provided");
  }

  public getExceptionConverter(): ExceptionConverter {
    return new NoopExceptionConverter();
  }
}

class PrefixMiddleware implements DriverMiddleware {
  constructor(private readonly prefix: string) {}

  public wrap(driver: Driver): Driver {
    const prefix = this.prefix;

    return {
      bindingStyle: driver.bindingStyle,
      connect: (params: Record<string, unknown>) => driver.connect(params),
      getExceptionConverter: () => driver.getExceptionConverter(),
      name: `${prefix}${driver.name}`,
    };
  }
}

describe("DriverManager", () => {
  it("lists available drivers", () => {
    expect(DriverManager.getAvailableDrivers().sort()).toEqual(["mssql", "mysql2"]);
  });

  it("throws when no driver is configured", () => {
    expect(() => DriverManager.getConnection({})).toThrow(DriverRequiredError);
  });

  it("throws for unknown driver name", () => {
    expect(() =>
      DriverManager.getConnection({
        driver: "invalid" as unknown as "mysql2",
      }),
    ).toThrow(UnknownDriverError);
  });

  it("uses driverClass when provided", () => {
    const connection = DriverManager.getConnection({
      driverClass: SpyDriver,
    });

    expect(connection.getDriver().name).toBe("spy");
  });

  it("prefers driverInstance over driverClass", () => {
    const driverInstance = new SpyDriver();
    const connection = DriverManager.getConnection({
      driverClass: NeverUseDriver,
      driverInstance,
    });

    expect(connection.getDriver()).toBe(driverInstance);
  });

  it("applies middlewares in declaration order", () => {
    const configuration = new Configuration();
    configuration.addMiddleware(new PrefixMiddleware("a:"));
    configuration.addMiddleware(new PrefixMiddleware("b:"));

    const connection = DriverManager.getConnection(
      {
        driverInstance: new SpyDriver(),
      },
      configuration,
    );

    expect(connection.getDriver().name).toBe("b:a:spy");
  });
});
