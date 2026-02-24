import { AbstractSchemaManager } from "./abstract-schema-manager";
import type { Column } from "./column";
import { Comparator } from "./comparator";
import { ComparatorConfig } from "./comparator-config";
import type { ForeignKeyConstraint } from "./foreign-key-constraint";
import type { Index } from "./index";
import { Sequence } from "./sequence";
import { View } from "./view";

export class SQLServerSchemaManager extends AbstractSchemaManager {
  public async listSchemaNames(): Promise<string[]> {
    const rows = await this.connection.fetchFirstColumn<unknown>(`
SELECT name
FROM   sys.schemas
WHERE  name NOT IN('guest', 'INFORMATION_SCHEMA', 'sys')
`);

    return rows
      .map((value) =>
        typeof value === "string" || typeof value === "number" ? String(value) : null,
      )
      .filter((value): value is string => value !== null);
  }

  public createComparator(config: ComparatorConfig = new ComparatorConfig()): Comparator {
    return new Comparator(config);
  }

  protected getListTableNamesSQL(): string {
    return "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = SCHEMA_NAME() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME";
  }

  protected getListViewNamesSQL(): string {
    return "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = SCHEMA_NAME() AND TABLE_TYPE = 'VIEW' ORDER BY TABLE_NAME";
  }

  protected override async determineCurrentSchemaName(): Promise<string | null> {
    return super.determineCurrentSchemaName();
  }

  protected override async selectTableColumns(
    databaseName: string,
    tableName: string | null = null,
  ): Promise<Record<string, unknown>[]> {
    return super.selectTableColumns(databaseName, tableName);
  }

  protected override async selectTableNames(
    databaseName: string,
  ): Promise<Record<string, unknown>[]> {
    return super.selectTableNames(databaseName);
  }

  protected override async selectIndexColumns(
    databaseName: string,
    tableName: string | null = null,
  ): Promise<Record<string, unknown>[]> {
    return super.selectIndexColumns(databaseName, tableName);
  }

  protected override async selectForeignKeyColumns(
    databaseName: string,
    tableName: string | null = null,
  ): Promise<Record<string, unknown>[]> {
    return super.selectForeignKeyColumns(databaseName, tableName);
  }

  protected override async fetchTableOptionsByTable(
    databaseName: string,
    tableName: string | null = null,
  ): Promise<Record<string, Record<string, unknown>>> {
    return super.fetchTableOptionsByTable(databaseName, tableName);
  }

  protected override _getPortableDatabaseDefinition(database: Record<string, unknown>): string {
    return super._getPortableDatabaseDefinition(database);
  }

  protected override _getPortableSequenceDefinition(sequence: Record<string, unknown>): Sequence {
    return super._getPortableSequenceDefinition(sequence);
  }

  protected override _getPortableTableColumnDefinition(
    tableColumn: Record<string, unknown>,
  ): Column {
    return super._getPortableTableColumnDefinition(tableColumn);
  }

  protected override _getPortableTableDefinition(table: Record<string, unknown>): string {
    return super._getPortableTableDefinition(table);
  }

  protected override _getPortableTableForeignKeyDefinition(
    tableForeignKey: Record<string, unknown>,
  ): ForeignKeyConstraint {
    return super._getPortableTableForeignKeyDefinition(tableForeignKey);
  }

  protected override _getPortableTableForeignKeysList(
    rows: Record<string, unknown>[],
  ): ForeignKeyConstraint[] {
    return super._getPortableTableForeignKeysList(rows);
  }

  protected override _getPortableTableIndexesList(
    rows: Record<string, unknown>[],
    tableName: string,
  ): Index[] {
    return super._getPortableTableIndexesList(rows, tableName);
  }

  protected override _getPortableViewDefinition(view: Record<string, unknown>): View {
    return super._getPortableViewDefinition(view);
  }
}
