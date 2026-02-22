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
import { DriverException } from "../../exception/driver-exception";
import { MySQLPlatform } from "../../platforms/mysql-platform";
import { AbstractSchemaManager } from "../../schema/abstract-schema-manager";
import { SchemaManagerFactory } from "../../schema/schema-manager-factory";
import type { CompiledQuery } from "../../types";

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
  public async executeQuery(query: CompiledQuery): Promise<DriverQueryResult> {
    if (query.sql.includes("TABLE_TYPE = 'BASE TABLE'")) {
      return {
        rows: [{ TABLE_NAME: "users" }, { TABLE_NAME: "posts" }],
      };
    }

    if (query.sql.includes("TABLE_TYPE = 'VIEW'")) {
      return {
        rows: [{ TABLE_NAME: "active_users" }],
      };
    }

    return { rows: [] };
  }

  public async executeStatement(_query: CompiledQuery): Promise<DriverExecutionResult> {
    return { affectedRows: 0, insertId: null };
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
