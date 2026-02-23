import type { DriverConnection, DriverExecutionResult, DriverQueryResult } from "../../driver";
import { DbalException, InvalidParameterException } from "../../exception/index";
import type { CompiledQuery } from "../../types";
import type { SQLite3DatabaseLike, SQLite3RunContextLike } from "./types";

export class SQLite3Connection implements DriverConnection {
  private inTransaction = false;

  constructor(
    private readonly database: SQLite3DatabaseLike,
    private readonly ownsClient: boolean,
  ) {}

  public async executeQuery(query: CompiledQuery): Promise<DriverQueryResult> {
    const parameters = this.toPositionalParameters(query.parameters);
    const rows = await this.queryAll(query.sql, parameters);
    const firstRow = rows[0];

    return {
      columns: firstRow === undefined ? [] : Object.keys(firstRow),
      rowCount: rows.length,
      rows,
    };
  }

  public async executeStatement(query: CompiledQuery): Promise<DriverExecutionResult> {
    const parameters = this.toPositionalParameters(query.parameters);
    const result = await this.queryRun(query.sql, parameters);

    return {
      affectedRows: result.changes ?? 0,
      insertId: result.lastID ?? null,
    };
  }

  public async beginTransaction(): Promise<void> {
    if (this.inTransaction) {
      throw new DbalException("A transaction is already active on this connection.");
    }

    await this.exec("BEGIN");
    this.inTransaction = true;
  }

  public async commit(): Promise<void> {
    if (!this.inTransaction) {
      throw new DbalException("No active transaction to commit.");
    }

    await this.exec("COMMIT");
    this.inTransaction = false;
  }

  public async rollBack(): Promise<void> {
    if (!this.inTransaction) {
      throw new DbalException("No active transaction to roll back.");
    }

    await this.exec("ROLLBACK");
    this.inTransaction = false;
  }

  public async createSavepoint(name: string): Promise<void> {
    await this.exec(`SAVEPOINT ${name}`);
  }

  public async releaseSavepoint(name: string): Promise<void> {
    await this.exec(`RELEASE SAVEPOINT ${name}`);
  }

  public async rollbackSavepoint(name: string): Promise<void> {
    await this.exec(`ROLLBACK TO SAVEPOINT ${name}`);
  }

  public quote(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
  }

  public async getServerVersion(): Promise<string> {
    const rows = await this.queryAll("SELECT sqlite_version() AS version", []);
    const version = rows[0]?.version ?? "unknown";

    return typeof version === "string" ? version : String(version);
  }

  public async close(): Promise<void> {
    if (this.inTransaction) {
      try {
        await this.exec("ROLLBACK");
      } catch {
        // best effort rollback during close
      } finally {
        this.inTransaction = false;
      }
    }

    if (!this.ownsClient) {
      return;
    }

    if (this.database.close === undefined) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      this.database.close?.((error) => {
        if (error !== null) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  public getNativeConnection(): unknown {
    return this.database;
  }

  private toPositionalParameters(parameters: CompiledQuery["parameters"]): unknown[] {
    if (Array.isArray(parameters)) {
      return parameters;
    }

    throw new InvalidParameterException(
      "The sqlite3 driver expects positional parameters after SQL compilation.",
    );
  }

  private async queryAll(
    sql: string,
    parameters: unknown[],
  ): Promise<Array<Record<string, unknown>>> {
    if (this.database.all === undefined) {
      throw new DbalException("The provided sqlite3 database does not expose all().");
    }

    const rows = await new Promise<unknown[]>((resolve, reject) => {
      this.database.all?.(sql, parameters, (error, result) => {
        if (error !== null) {
          reject(error);
          return;
        }

        resolve(Array.isArray(result) ? result : []);
      });
    });

    const normalized: Array<Record<string, unknown>> = [];
    for (const row of rows) {
      if (row !== null && typeof row === "object" && !Array.isArray(row)) {
        normalized.push(row as Record<string, unknown>);
      }
    }

    return normalized;
  }

  private async queryRun(sql: string, parameters: unknown[]): Promise<SQLite3RunContextLike> {
    if (this.database.run === undefined) {
      throw new DbalException("The provided sqlite3 database does not expose run().");
    }

    return new Promise<SQLite3RunContextLike>((resolve, reject) => {
      this.database.run?.(sql, parameters, function (this: SQLite3RunContextLike, error) {
        if (error !== null) {
          reject(error);
          return;
        }

        resolve({
          changes: typeof this?.changes === "number" ? this.changes : 0,
          lastID: typeof this?.lastID === "number" ? this.lastID : undefined,
        });
      });
    });
  }

  private async exec(sql: string): Promise<void> {
    if (this.database.exec !== undefined) {
      await new Promise<void>((resolve, reject) => {
        this.database.exec?.(sql, (error) => {
          if (error !== null) {
            reject(error);
            return;
          }

          resolve();
        });
      });

      return;
    }

    await this.queryRun(sql, []);
  }
}
