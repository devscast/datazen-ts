import type { Connection } from "../connection";
import type { AbstractPlatform } from "../platforms/abstract-platform";
import { Schema } from "./schema";
import { Table } from "./table";
import { View } from "./view";

/**
 * Base class for schema managers.
 *
 * This initial port exposes object-name introspection and schema assembly,
 * with room for deeper table-definition introspection in follow-up steps.
 */
export abstract class AbstractSchemaManager {
  constructor(
    protected readonly connection: Connection,
    protected readonly platform: AbstractPlatform,
  ) {}

  public async listTableNames(): Promise<string[]> {
    const names = await this.connection.fetchFirstColumn<unknown>(this.getListTableNamesSQL());
    const filter = this.connection.getConfiguration().getSchemaAssetsFilter();

    return names
      .map((value) => normalizeName(value))
      .filter((value): value is string => value !== null)
      .filter((value) => filter(value));
  }

  public async listTables(): Promise<Table[]> {
    const names = await this.listTableNames();
    return names.map((name) => new Table(name));
  }

  public async tableExists(tableName: string): Promise<boolean> {
    const names = await this.listTableNames();
    const normalized = tableName.toLowerCase();

    return names.some((name) => name.toLowerCase() === normalized);
  }

  public async listViewNames(): Promise<string[]> {
    const sql = this.getListViewNamesSQL();
    if (sql === null) {
      return [];
    }

    const names = await this.connection.fetchFirstColumn<unknown>(sql);
    const filter = this.connection.getConfiguration().getSchemaAssetsFilter();

    return names
      .map((value) => normalizeName(value))
      .filter((value): value is string => value !== null)
      .filter((value) => filter(value));
  }

  public async listViews(): Promise<View[]> {
    const names = await this.listViewNames();
    return names.map((name) => new View(name, ""));
  }

  public async createSchema(): Promise<Schema> {
    const tables = await this.listTables();
    return new Schema(tables);
  }

  public getConnection(): Connection {
    return this.connection;
  }

  public getDatabasePlatform(): AbstractPlatform {
    return this.platform;
  }

  protected getListViewNamesSQL(): string | null {
    return null;
  }

  protected abstract getListTableNamesSQL(): string;
}

function normalizeName(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }

  return null;
}
