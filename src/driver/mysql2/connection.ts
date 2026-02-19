import type { DriverConnection, DriverExecutionResult, DriverQueryResult } from "../../driver";
import { DbalError, InvalidParameterError } from "../../exception/index";
import type { CompiledQuery } from "../../types";
import type { MySQL2ConnectionLike, MySQL2PoolLike } from "./types";

export class MySQL2Connection implements DriverConnection {
  private transactionConnection: MySQL2ConnectionLike | null = null;

  constructor(
    private readonly client: MySQL2PoolLike | MySQL2ConnectionLike,
    private readonly ownsClient: boolean,
  ) {}

  public async executeQuery(query: CompiledQuery): Promise<DriverQueryResult> {
    const parameters = this.toPositionalParameters(query.parameters);
    const payload = await this.executeRaw(query.sql, parameters);

    const rows = this.toRows(payload);
    const firstRow = rows[0];

    return {
      columns: firstRow === undefined ? [] : Object.keys(firstRow),
      rowCount: rows.length,
      rows,
    };
  }

  public async executeStatement(query: CompiledQuery): Promise<DriverExecutionResult> {
    const parameters = this.toPositionalParameters(query.parameters);
    const payload = await this.executeRaw(query.sql, parameters);
    const metadata = this.toMetadata(payload);

    return {
      affectedRows: metadata.affectedRows,
      insertId: metadata.insertId,
    };
  }

  public async beginTransaction(): Promise<void> {
    if (this.transactionConnection !== null) {
      throw new DbalError("A transaction is already active on this connection.");
    }

    const connection = await this.acquireTransactionConnection();
    if (connection.beginTransaction === undefined) {
      throw new DbalError("The provided mysql2 connection does not support beginTransaction().");
    }

    await connection.beginTransaction();
    this.transactionConnection = connection;
  }

  public async commit(): Promise<void> {
    const connection = this.transactionConnection;
    if (connection === null) {
      throw new DbalError("No active transaction to commit.");
    }

    if (connection.commit === undefined) {
      throw new DbalError("The provided mysql2 connection does not support commit().");
    }

    try {
      await connection.commit();
    } finally {
      this.releaseTransactionConnection(connection);
      this.transactionConnection = null;
    }
  }

  public async rollBack(): Promise<void> {
    const connection = this.transactionConnection;
    if (connection === null) {
      throw new DbalError("No active transaction to roll back.");
    }

    if (connection.rollback === undefined) {
      throw new DbalError("The provided mysql2 connection does not support rollback().");
    }

    try {
      await connection.rollback();
    } finally {
      this.releaseTransactionConnection(connection);
      this.transactionConnection = null;
    }
  }

  public async createSavepoint(name: string): Promise<void> {
    await this.executeRaw(`SAVEPOINT ${name}`, []);
  }

  public async releaseSavepoint(name: string): Promise<void> {
    await this.executeRaw(`RELEASE SAVEPOINT ${name}`, []);
  }

  public async rollbackSavepoint(name: string): Promise<void> {
    await this.executeRaw(`ROLLBACK TO SAVEPOINT ${name}`, []);
  }

  public quote(value: string): string {
    return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
  }

  public async getServerVersion(): Promise<string> {
    const payload = await this.executeRaw("SELECT VERSION() AS version", []);
    const rows = this.toRows(payload);
    const firstRow = rows[0];
    const version = firstRow?.version;

    return typeof version === "string" ? version : String(version ?? "unknown");
  }

  public async close(): Promise<void> {
    if (this.transactionConnection !== null) {
      this.releaseTransactionConnection(this.transactionConnection);
      this.transactionConnection = null;
    }

    if (this.ownsClient && "end" in this.client && typeof this.client.end === "function") {
      await this.client.end();
    }
  }

  public getNativeConnection(): unknown {
    return this.transactionConnection ?? this.client;
  }

  private async acquireTransactionConnection(): Promise<MySQL2ConnectionLike> {
    if ("getConnection" in this.client && typeof this.client.getConnection === "function") {
      return this.client.getConnection();
    }

    return this.client as MySQL2ConnectionLike;
  }

  private releaseTransactionConnection(connection: MySQL2ConnectionLike): void {
    if ("release" in connection && typeof connection.release === "function") {
      connection.release();
    }
  }

  private async executeRaw(sql: string, parameters: unknown[]): Promise<unknown> {
    const executor = this.transactionConnection ?? this.client;

    if ("execute" in executor && typeof executor.execute === "function") {
      const result = await executor.execute(sql, parameters);
      return this.unwrapDriverResult(result);
    }

    if ("query" in executor && typeof executor.query === "function") {
      const result = await executor.query(sql, parameters);
      return this.unwrapDriverResult(result);
    }

    throw new DbalError("The provided mysql2 client does not expose query() or execute().");
  }

  private unwrapDriverResult(result: unknown): unknown {
    if (!Array.isArray(result)) {
      return result;
    }

    return result[0];
  }

  private toRows(result: unknown): Array<Record<string, unknown>> {
    if (!Array.isArray(result)) {
      return [];
    }

    const rows: Array<Record<string, unknown>> = [];
    for (const row of result) {
      if (row !== null && typeof row === "object" && !Array.isArray(row)) {
        rows.push(row as Record<string, unknown>);
      }
    }

    return rows;
  }

  private toMetadata(result: unknown): { affectedRows: number; insertId: number | string | null } {
    if (result !== null && typeof result === "object" && !Array.isArray(result)) {
      const affectedRowsValue = (result as { affectedRows?: unknown }).affectedRows;
      const insertIdValue = (result as { insertId?: unknown }).insertId;

      return {
        affectedRows: typeof affectedRowsValue === "number" ? affectedRowsValue : 0,
        insertId:
          typeof insertIdValue === "number" || typeof insertIdValue === "string"
            ? insertIdValue
            : null,
      };
    }

    if (Array.isArray(result)) {
      return {
        affectedRows: result.length,
        insertId: null,
      };
    }

    return {
      affectedRows: 0,
      insertId: null,
    };
  }

  private toPositionalParameters(parameters: CompiledQuery["parameters"]): unknown[] {
    if (Array.isArray(parameters)) {
      return parameters;
    }

    throw new InvalidParameterError(
      "The mysql2 driver expects positional parameters after SQL compilation.",
    );
  }
}
