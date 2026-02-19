import type { DriverConnection, DriverExecutionResult, DriverQueryResult } from "../../driver";
import { DbalError, InvalidParameterError } from "../../exception/index";
import type { CompiledQuery } from "../../types";
import type { MSSQLPoolLike, MSSQLRequestLike, MSSQLTransactionLike } from "./types";

export class MSSQLConnection implements DriverConnection {
  private transaction: MSSQLTransactionLike | null = null;
  private serialQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly pool: MSSQLPoolLike,
    private readonly ownsClient: boolean,
  ) {}

  public async executeQuery(query: CompiledQuery): Promise<DriverQueryResult> {
    return this.runSerial(async () => {
      const request = this.createRequest();
      const namedParameters = this.toNamedParameters(query.parameters);
      this.bindNamedParameters(request, namedParameters);

      const payload = await request.query(query.sql);
      const rows = this.toRows(payload);
      const firstRow = rows[0];

      return {
        columns: firstRow === undefined ? [] : Object.keys(firstRow),
        rowCount: rows.length,
        rows,
      };
    });
  }

  public async executeStatement(query: CompiledQuery): Promise<DriverExecutionResult> {
    return this.runSerial(async () => {
      const request = this.createRequest();
      const namedParameters = this.toNamedParameters(query.parameters);
      this.bindNamedParameters(request, namedParameters);

      const payload = await request.query(query.sql);
      const rowsAffected = this.getRowsAffected(payload);

      return {
        affectedRows: rowsAffected,
        insertId: null,
      };
    });
  }

  public async beginTransaction(): Promise<void> {
    if (this.transaction !== null) {
      throw new DbalError("A transaction is already active on this connection.");
    }

    const transaction = this.pool.transaction();
    await transaction.begin();
    this.transaction = transaction;
  }

  public async commit(): Promise<void> {
    const transaction = this.transaction;
    if (transaction === null) {
      throw new DbalError("No active transaction to commit.");
    }

    await transaction.commit();
    this.transaction = null;
  }

  public async rollBack(): Promise<void> {
    const transaction = this.transaction;
    if (transaction === null) {
      throw new DbalError("No active transaction to roll back.");
    }

    await transaction.rollback();
    this.transaction = null;
  }

  public async createSavepoint(name: string): Promise<void> {
    if (this.transaction === null) {
      throw new DbalError("Cannot create a savepoint without an active transaction.");
    }

    await this.transaction.request().query(`SAVE TRANSACTION ${name}`);
  }

  public async releaseSavepoint(_name: string): Promise<void> {
    // SQL Server does not provide explicit savepoint release.
  }

  public async rollbackSavepoint(name: string): Promise<void> {
    if (this.transaction === null) {
      throw new DbalError("Cannot roll back a savepoint without an active transaction.");
    }

    await this.transaction.request().query(`ROLLBACK TRANSACTION ${name}`);
  }

  public quote(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
  }

  public async getServerVersion(): Promise<string> {
    const request = this.createRequest();
    const payload = await request.query("SELECT @@VERSION AS version");
    const rows = this.toRows(payload);
    const firstRow = rows[0];
    const version = firstRow?.version;

    return typeof version === "string" ? version : String(version ?? "unknown");
  }

  public async close(): Promise<void> {
    if (this.transaction !== null) {
      await this.transaction.rollback();
      this.transaction = null;
    }

    if (this.ownsClient && this.pool.close !== undefined) {
      await this.pool.close();
    }
  }

  public getNativeConnection(): unknown {
    return this.pool;
  }

  private createRequest(): MSSQLRequestLike {
    if (this.transaction !== null) {
      return this.transaction.request();
    }

    return this.pool.request();
  }

  private bindNamedParameters(
    request: MSSQLRequestLike,
    parameters: Record<string, unknown>,
  ): void {
    for (const [name, value] of Object.entries(parameters)) {
      request.input(name, value);
    }
  }

  private toNamedParameters(parameters: CompiledQuery["parameters"]): Record<string, unknown> {
    if (!Array.isArray(parameters)) {
      return parameters;
    }

    throw new InvalidParameterError(
      "The mssql driver expects named parameters after SQL compilation.",
    );
  }

  private toRows(payload: unknown): Array<Record<string, unknown>> {
    if (payload === null || typeof payload !== "object") {
      return [];
    }

    const recordset = (payload as { recordset?: unknown }).recordset;
    if (!Array.isArray(recordset)) {
      return [];
    }

    const rows: Array<Record<string, unknown>> = [];
    for (const row of recordset) {
      if (row !== null && typeof row === "object" && !Array.isArray(row)) {
        rows.push(row as Record<string, unknown>);
      }
    }

    return rows;
  }

  private getRowsAffected(payload: unknown): number {
    if (payload === null || typeof payload !== "object") {
      return 0;
    }

    const rowsAffected = (payload as { rowsAffected?: unknown }).rowsAffected;
    if (!Array.isArray(rowsAffected)) {
      return 0;
    }

    return rowsAffected.reduce((total, value) => {
      if (typeof value === "number") {
        return total + value;
      }

      return total;
    }, 0);
  }

  private runSerial<T>(work: () => Promise<T>): Promise<T> {
    const current = this.serialQueue.then(work, work);
    this.serialQueue = current.then(
      () => undefined,
      () => undefined,
    );

    return current;
  }
}
