import { InvalidParameterException } from "../../exception/invalid-parameter-exception";
import { ArrayResult } from "../array-result";
import type { Connection as DriverConnection } from "../connection";
import { IdentityColumnsNotSupported } from "../exception/identity-columns-not-supported";
import type { Result as DriverResult } from "../result";
import type { Statement as DriverStatement } from "../statement";
import { MSSQLStatement } from "./statement";
import type { MSSQLPoolLike, MSSQLRequestLike, MSSQLTransactionLike } from "./types";

export class MSSQLConnection implements DriverConnection {
  private transaction: MSSQLTransactionLike | null = null;
  private serialQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly pool: MSSQLPoolLike,
    private readonly ownsClient: boolean,
  ) {}

  public async prepare(sql: string): Promise<DriverStatement> {
    return new MSSQLStatement(this, sql);
  }

  public async query(sql: string): Promise<DriverResult> {
    return this.runSerial(async () => {
      const request = this.createRequest();
      const payload = await request.query(sql);
      return this.toDriverResult(payload);
    });
  }

  public quote(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
  }

  public async exec(sql: string): Promise<number | string> {
    return this.runSerial(async () => {
      const request = this.createRequest();
      const payload = await request.query(sql);
      return this.getRowsAffected(payload);
    });
  }

  public async lastInsertId(): Promise<number | string> {
    throw IdentityColumnsNotSupported.new();
  }

  public async beginTransaction(): Promise<void> {
    if (this.transaction !== null) {
      throw new Error("A transaction is already active on this connection.");
    }

    const transaction = this.pool.transaction();
    await transaction.begin();
    this.transaction = transaction;
  }

  public async commit(): Promise<void> {
    const transaction = this.transaction;
    if (transaction === null) {
      throw new Error("No active transaction to commit.");
    }

    await transaction.commit();
    this.transaction = null;
  }

  public async rollBack(): Promise<void> {
    const transaction = this.transaction;
    if (transaction === null) {
      throw new Error("No active transaction to roll back.");
    }

    await transaction.rollback();
    this.transaction = null;
  }

  public async getServerVersion(): Promise<string> {
    const result = await this.query("SELECT @@VERSION AS version");
    const version = result.fetchOne() ?? "unknown";
    result.free();

    return typeof version === "string" ? version : String(version);
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

  public async executePrepared(
    sql: string,
    parameters: Record<string, unknown>,
  ): Promise<DriverResult> {
    return this.runSerial(async () => {
      const request = this.createRequest();
      this.bindNamedParameters(request, parameters);
      const payload = await request.query(sql);

      return this.toDriverResult(payload);
    });
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

  public toNamedParameters(parameters: unknown): Record<string, unknown> {
    if (parameters !== null && typeof parameters === "object" && !Array.isArray(parameters)) {
      return parameters as Record<string, unknown>;
    }

    throw new InvalidParameterException(
      "The mssql driver expects named parameters after SQL compilation.",
    );
  }

  private toDriverResult(payload: unknown): DriverResult {
    const rows = this.toRows(payload);
    const firstRow = rows[0];

    return new ArrayResult(
      rows,
      firstRow === undefined ? [] : Object.keys(firstRow),
      rows.length > 0 ? rows.length : this.getRowsAffected(payload),
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
