import { describe, expect, it } from "vitest";

import { Configuration } from "../../configuration";
import { Connection } from "../../connection";
import { type Driver, type DriverConnection } from "../../driver";
import type {
  ExceptionConverter,
  ExceptionConverterContext,
} from "../../driver/api/exception-converter";
import { ArrayResult } from "../../driver/array-result";
import { ParameterBindingStyle } from "../../driver/internal-parameter-binding-style";
import { DriverException } from "../../exception/driver-exception";
import { MySQLPlatform } from "../../platforms/mysql-platform";
import { AbstractSchemaManager } from "../../schema/abstract-schema-manager";
import { SchemaManagerFactory } from "../../schema/schema-manager-factory";

class NoopExceptionConverter implements ExceptionConverter {
  public convert(error: unknown, context: ExceptionConverterContext): DriverException {
    return new DriverException("driver failure", {
      cause: error,
      driverName: "schema-spy",
      operation: context.operation,
      parameters: context.query?.parameters,
      sql: context.query?.sql,
    });
  }
}

class SchemaSpyConnection implements DriverConnection {
  public async prepare(sql: string) {
    return {
      bindValue: () => undefined,
      execute: async () => this.query(sql),
    };
  }

  public async query(sql: string) {
    if (sql.includes("TABLE_TYPE = 'BASE TABLE'")) {
      return new ArrayResult([{ TABLE_NAME: "users" }, { TABLE_NAME: "posts" }], ["TABLE_NAME"]);
    }

    if (sql.includes("TABLE_TYPE = 'VIEW'")) {
      return new ArrayResult([{ TABLE_NAME: "active_users" }], ["TABLE_NAME"]);
    }

    return new ArrayResult([], [], 0);
  }

  public quote(value: string): string {
    return `'${value}'`;
  }

  public async exec(_sql: string): Promise<number | string> {
    return 0;
  }

  public async lastInsertId(): Promise<number | string> {
    return 0;
  }

  public async beginTransaction(): Promise<void> {}

  public async commit(): Promise<void> {}

  public async rollBack(): Promise<void> {}

  public async getServerVersion(): Promise<string> {
    return "8.0.0";
  }

  public async close(): Promise<void> {}

  public getNativeConnection(): unknown {
    return this;
  }
}

class SchemaSpyDriver implements Driver {
  public readonly name = "schema-spy";
  public readonly bindingStyle = ParameterBindingStyle.POSITIONAL;
  private readonly converter = new NoopExceptionConverter();

  public async connect(_params: Record<string, unknown>): Promise<DriverConnection> {
    return new SchemaSpyConnection();
  }

  public getExceptionConverter(): ExceptionConverter {
    return this.converter;
  }

  public getDatabasePlatform(): MySQLPlatform {
    return new MySQLPlatform();
  }
}

class CustomSchemaManager extends AbstractSchemaManager {
  protected getListTableNamesSQL(): string {
    return "SELECT 'custom_table'";
  }
}

class CustomSchemaManagerFactory implements SchemaManagerFactory {
  public createSchemaManager(connection: Connection): AbstractSchemaManager {
    return new CustomSchemaManager(connection, connection.getDatabasePlatform());
  }
}

describe("Connection schema manager integration", () => {
  it("creates platform schema manager by default", async () => {
    const connection = new Connection({}, new SchemaSpyDriver());
    const manager = connection.createSchemaManager();

    expect(manager).toBeInstanceOf(AbstractSchemaManager);
    await expect(manager.listTableNames()).resolves.toEqual(["users", "posts"]);
    await expect(manager.listViewNames()).resolves.toEqual(["active_users"]);
    await expect(manager.tableExists("users")).resolves.toBe(true);
  });

  it("uses custom schema manager factory from configuration", () => {
    const configuration = new Configuration({
      schemaManagerFactory: new CustomSchemaManagerFactory(),
    });

    const connection = new Connection({}, new SchemaSpyDriver(), configuration);
    const manager = connection.createSchemaManager();

    expect(manager).toBeInstanceOf(CustomSchemaManager);
  });
});
