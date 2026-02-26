import type { Connection } from "../../connection";
import { IndexType } from "../../schema/index/index-type";
import { ForeignKeyConstraintColumnMetadataRow } from "../../schema/metadata/foreign-key-constraint-column-metadata-row";
import { IndexColumnMetadataRow } from "../../schema/metadata/index-column-metadata-row";
import type { MetadataProvider } from "../../schema/metadata/metadata-provider";
import { PrimaryKeyConstraintColumnRow } from "../../schema/metadata/primary-key-constraint-column-row";
import { TableColumnMetadataRow } from "../../schema/metadata/table-column-metadata-row";
import { TableMetadataRow } from "../../schema/metadata/table-metadata-row";
import { ViewMetadataRow } from "../../schema/metadata/view-metadata-row";
import {
  createColumnFromMetadataRow,
  mapMatchType,
  mapReferentialAction,
  pickBoolean,
  pickNumber,
  pickString,
} from "../_internal/metadata-provider-utils";
import { NotSupported } from "../exception/not-supported";
import type { SQLitePlatform } from "../sqlite-platform";

type MetadataQueryConnection = Pick<
  Connection,
  "fetchOne" | "fetchAllAssociative" | "fetchAllNumeric" | "fetchFirstColumn"
>;

export class SQLiteMetadataProvider implements MetadataProvider {
  public constructor(
    private readonly connection: MetadataQueryConnection,
    readonly _platform: SQLitePlatform,
  ) {}

  public async getAllDatabaseNames(): Promise<never[]> {
    throw NotSupported.new("SQLiteMetadataProvider.getAllDatabaseNames");
  }

  public async getAllSchemaNames(): Promise<never[]> {
    throw NotSupported.new("SQLiteMetadataProvider.getAllSchemaNames");
  }

  public async getAllTableNames(): Promise<TableMetadataRow[]> {
    const sql = `SELECT name
FROM sqlite_master
WHERE type = 'table'
  AND name NOT IN ('geometry_columns', 'spatial_ref_sys', 'sqlite_sequence')`;

    const names = await this.connection.fetchFirstColumn<string>(sql);
    return names.map((tableName) => new TableMetadataRow(null, String(tableName), {}));
  }

  public async getTableColumnsForAllTables(): Promise<TableColumnMetadataRow[]> {
    const tables = await this.getAllTableNames();
    const result: TableColumnMetadataRow[] = [];

    for (const table of tables) {
      result.push(...(await this.getTableColumnsForTable(null, table.getTableName())));
    }

    return result;
  }

  public async getTableColumnsForTable(
    _schemaName: string | null,
    tableName: string,
  ): Promise<TableColumnMetadataRow[]> {
    const sql = `PRAGMA table_info('${escapeSqliteIdentifier(tableName)}')`;
    const rows = await this.connection.fetchAllAssociative<Record<string, unknown>>(sql);

    return rows.map(
      (row) =>
        new TableColumnMetadataRow(
          null,
          tableName,
          createColumnFromMetadataRow(this._platform, {
            ...row,
            column_name: pickString(row, "name"),
            data_type: pickString(row, "type"),
            length: parseSqliteTypeLength(pickString(row, "type")),
            precision: parseSqliteTypePrecision(pickString(row, "type")),
            scale: parseSqliteTypeScale(pickString(row, "type")),
          }),
        ),
    );
  }

  public async getIndexColumnsForAllTables(): Promise<IndexColumnMetadataRow[]> {
    const tables = await this.getAllTableNames();
    const result: IndexColumnMetadataRow[] = [];

    for (const table of tables) {
      result.push(...(await this.getIndexColumnsForTable(null, table.getTableName())));
    }

    return result;
  }

  public async getIndexColumnsForTable(
    _schemaName: string | null,
    tableName: string,
  ): Promise<IndexColumnMetadataRow[]> {
    const indexes = await this.connection.fetchAllAssociative<Record<string, unknown>>(
      `PRAGMA index_list('${escapeSqliteIdentifier(tableName)}')`,
    );
    const result: IndexColumnMetadataRow[] = [];

    for (const indexRow of indexes) {
      if (pickString(indexRow, "origin") === "pk") {
        continue;
      }

      const indexName = pickString(indexRow, "name") ?? "";
      const columns = await this.connection.fetchAllAssociative<Record<string, unknown>>(
        `PRAGMA index_info('${escapeSqliteIdentifier(indexName)}')`,
      );

      for (const columnRow of columns) {
        result.push(
          new IndexColumnMetadataRow(
            null,
            tableName,
            indexName,
            pickBoolean(indexRow, "unique") === true ? IndexType.UNIQUE : IndexType.REGULAR,
            false,
            pickBoolean(indexRow, "partial") === true ? "<partial>" : null,
            pickString(columnRow, "name") ?? "",
            null,
          ),
        );
      }
    }

    return result;
  }

  public async getPrimaryKeyConstraintColumnsForAllTables(): Promise<
    PrimaryKeyConstraintColumnRow[]
  > {
    const tables = await this.getAllTableNames();
    const result: PrimaryKeyConstraintColumnRow[] = [];

    for (const table of tables) {
      result.push(
        ...(await this.getPrimaryKeyConstraintColumnsForTable(null, table.getTableName())),
      );
    }

    return result;
  }

  public async getPrimaryKeyConstraintColumnsForTable(
    _schemaName: string | null,
    tableName: string,
  ): Promise<PrimaryKeyConstraintColumnRow[]> {
    const rows = await this.connection.fetchAllAssociative<Record<string, unknown>>(
      `PRAGMA table_info('${escapeSqliteIdentifier(tableName)}')`,
    );

    return rows
      .filter((row) => (pickNumber(row, "pk") ?? 0) > 0)
      .sort((left, right) => (pickNumber(left, "pk") ?? 0) - (pickNumber(right, "pk") ?? 0))
      .map(
        (row) =>
          new PrimaryKeyConstraintColumnRow(
            null,
            tableName,
            null,
            false,
            pickString(row, "name") ?? "",
          ),
      );
  }

  public async getForeignKeyConstraintColumnsForAllTables(): Promise<
    ForeignKeyConstraintColumnMetadataRow[]
  > {
    const tables = await this.getAllTableNames();
    const result: ForeignKeyConstraintColumnMetadataRow[] = [];

    for (const table of tables) {
      result.push(
        ...(await this.getForeignKeyConstraintColumnsForTable(null, table.getTableName())),
      );
    }

    return result;
  }

  public async getForeignKeyConstraintColumnsForTable(
    _schemaName: string | null,
    tableName: string,
  ): Promise<ForeignKeyConstraintColumnMetadataRow[]> {
    const rows = await this.connection.fetchAllAssociative<Record<string, unknown>>(
      `PRAGMA foreign_key_list('${escapeSqliteIdentifier(tableName)}')`,
    );

    return rows.map(
      (row) =>
        new ForeignKeyConstraintColumnMetadataRow(
          null,
          tableName,
          pickNumber(row, "id"),
          null,
          null,
          pickString(row, "table") ?? "",
          mapMatchType(pickString(row, "match")),
          mapReferentialAction(pickString(row, "on_update")),
          mapReferentialAction(pickString(row, "on_delete")),
          false,
          false,
          pickString(row, "from") ?? "",
          pickString(row, "to") ?? "",
        ),
    );
  }

  public async getTableOptionsForAllTables(): Promise<TableMetadataRow[]> {
    return (await this.getAllTableNames()).map(
      (table) => new TableMetadataRow(null, table.getTableName(), {}),
    );
  }

  public async getTableOptionsForTable(
    _schemaName: string | null,
    tableName: string,
  ): Promise<TableMetadataRow[]> {
    return [new TableMetadataRow(null, tableName, {})];
  }

  public async getAllViews(): Promise<ViewMetadataRow[]> {
    const sql = `SELECT name, sql
FROM sqlite_master
WHERE type = 'view'
ORDER BY name`;

    const rows = await this.connection.fetchAllNumeric<[string, string]>(sql);
    return rows.map((row) => new ViewMetadataRow(null, String(row[0]), String(row[1])));
  }

  public async getAllSequences(): Promise<never[]> {
    throw NotSupported.new("SQLiteMetadataProvider.getAllSequences");
  }
}

function escapeSqliteIdentifier(identifier: string): string {
  return identifier.replaceAll("'", "''");
}

function parseSqliteTypeLength(type: string | null): number | null {
  if (type === null) {
    return null;
  }

  const match = /\(\s*(\d+)\s*(?:,\s*\d+\s*)?\)$/.exec(type);
  if (match === null) {
    return null;
  }

  const length = Number.parseInt(match[1]!, 10);
  return Number.isFinite(length) ? length : null;
}

function parseSqliteTypePrecision(type: string | null): number | null {
  if (type === null) {
    return null;
  }

  const match = /\(\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(type);
  if (match === null) {
    return null;
  }

  const precision = Number.parseInt(match[1]!, 10);
  return Number.isFinite(precision) ? precision : null;
}

function parseSqliteTypeScale(type: string | null): number | null {
  if (type === null) {
    return null;
  }

  const match = /\(\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(type);
  if (match === null) {
    return null;
  }

  const scale = Number.parseInt(match[2]!, 10);
  return Number.isFinite(scale) ? scale : null;
}
