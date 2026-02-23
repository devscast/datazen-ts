import type { DriverConnection, DriverExecutionResult, DriverQueryResult } from "../../driver";
import { DbalException, InvalidParameterException } from "../../exception/index";
import { Parser, type Visitor } from "../../sql/parser";
import type { CompiledQuery } from "../../types";
import type { PgPoolClientLike, PgPoolLike, PgQueryResultLike, PgQueryableLike } from "./types";

export class PgConnection implements DriverConnection {
  private readonly parser = new Parser(false);
  private transactionClient: PgPoolClientLike | null = null;
  private inTransaction = false;

  constructor(
    private readonly client: PgPoolLike | PgPoolClientLike,
    private readonly ownsClient: boolean,
  ) {}

  public async executeQuery(query: CompiledQuery): Promise<DriverQueryResult> {
    const parameters = this.toPositionalParameters(query.parameters);
    const sql = this.convertPositionalPlaceholders(query.sql);
    const payload = await this.getQueryable().query(sql, parameters);
    const rows = this.toRows(payload);
    const firstRow = rows[0];

    return {
      columns: this.toColumns(payload, firstRow),
      rowCount: typeof payload.rowCount === "number" ? payload.rowCount : rows.length,
      rows,
    };
  }

  public async executeStatement(query: CompiledQuery): Promise<DriverExecutionResult> {
    const parameters = this.toPositionalParameters(query.parameters);
    const sql = this.convertPositionalPlaceholders(query.sql);
    const payload = await this.getQueryable().query(sql, parameters);

    return {
      affectedRows: typeof payload.rowCount === "number" ? payload.rowCount : 0,
      insertId: null,
    };
  }

  public async beginTransaction(): Promise<void> {
    if (this.inTransaction) {
      throw new DbalException("A transaction is already active on this connection.");
    }

    if (this.transactionClient === null && this.isPool(this.client)) {
      this.transactionClient = await this.client.connect();
    }

    await this.getQueryable().query("BEGIN");
    this.inTransaction = true;
  }

  public async commit(): Promise<void> {
    if (!this.inTransaction) {
      throw new DbalException("No active transaction to commit.");
    }

    try {
      await this.getQueryable().query("COMMIT");
    } finally {
      this.inTransaction = false;
      this.releaseTransactionClient();
    }
  }

  public async rollBack(): Promise<void> {
    if (!this.inTransaction) {
      throw new DbalException("No active transaction to roll back.");
    }

    try {
      await this.getQueryable().query("ROLLBACK");
    } finally {
      this.inTransaction = false;
      this.releaseTransactionClient();
    }
  }

  public async createSavepoint(name: string): Promise<void> {
    await this.getQueryable().query(`SAVEPOINT ${name}`);
  }

  public async releaseSavepoint(name: string): Promise<void> {
    await this.getQueryable().query(`RELEASE SAVEPOINT ${name}`);
  }

  public async rollbackSavepoint(name: string): Promise<void> {
    await this.getQueryable().query(`ROLLBACK TO SAVEPOINT ${name}`);
  }

  public quote(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
  }

  public async getServerVersion(): Promise<string> {
    const result = await this.getQueryable().query("SHOW server_version");
    const rows = this.toRows(result);
    const firstRow = rows[0];

    const version =
      firstRow?.server_version ?? firstRow?.serverVersion ?? firstRow?.version ?? "unknown";

    return typeof version === "string" ? version : String(version);
  }

  public async close(): Promise<void> {
    if (this.inTransaction) {
      try {
        await this.getQueryable().query("ROLLBACK");
      } catch {
        // best effort rollback during close
      } finally {
        this.inTransaction = false;
      }
    }

    this.releaseTransactionClient();

    if (this.ownsClient && "end" in this.client && typeof this.client.end === "function") {
      await this.client.end();
    }
  }

  public getNativeConnection(): unknown {
    return this.transactionClient ?? this.client;
  }

  private getQueryable(): PgQueryableLike {
    return this.transactionClient ?? this.client;
  }

  private isPool(
    client: PgPoolLike | PgPoolClientLike,
  ): client is PgPoolLike & { connect: NonNullable<PgPoolLike["connect"]> } {
    return typeof (client as PgPoolLike).connect === "function";
  }

  private releaseTransactionClient(): void {
    if (this.transactionClient?.release !== undefined) {
      this.transactionClient.release();
    }

    this.transactionClient = null;
  }

  private convertPositionalPlaceholders(sql: string): string {
    const parts: string[] = [];
    let index = 0;

    const visitor: Visitor = {
      acceptNamedParameter: (): void => {
        throw new InvalidParameterException(
          "The pg driver expects positional parameters after SQL compilation.",
        );
      },
      acceptOther: (fragment: string): void => {
        parts.push(fragment);
      },
      acceptPositionalParameter: (): void => {
        index += 1;
        parts.push(`$${index}`);
      },
    };

    this.parser.parse(sql, visitor);
    return parts.join("");
  }

  private toPositionalParameters(parameters: CompiledQuery["parameters"]): unknown[] {
    if (Array.isArray(parameters)) {
      return parameters;
    }

    throw new InvalidParameterException(
      "The pg driver expects positional parameters after SQL compilation.",
    );
  }

  private toRows(payload: PgQueryResultLike): Array<Record<string, unknown>> {
    if (!Array.isArray(payload.rows)) {
      return [];
    }

    const rows: Array<Record<string, unknown>> = [];
    for (const row of payload.rows) {
      if (row !== null && typeof row === "object" && !Array.isArray(row)) {
        rows.push(row as Record<string, unknown>);
      }
    }

    return rows;
  }

  private toColumns(
    payload: PgQueryResultLike,
    firstRow: Record<string, unknown> | undefined,
  ): string[] {
    if (Array.isArray(payload.fields)) {
      const names = payload.fields
        .map((field) => field?.name)
        .filter((name): name is string => typeof name === "string");
      if (names.length > 0) {
        return names;
      }
    }

    return firstRow === undefined ? [] : Object.keys(firstRow);
  }
}
