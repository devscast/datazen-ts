import type { Connection } from "../../connection";
import { DatabaseMetadataRow } from "../../schema/metadata/database-metadata-row";
import { ForeignKeyConstraintColumnMetadataRow } from "../../schema/metadata/foreign-key-constraint-column-metadata-row";
import { IndexColumnMetadataRow } from "../../schema/metadata/index-column-metadata-row";
import type { MetadataProvider } from "../../schema/metadata/metadata-provider";
import { PrimaryKeyConstraintColumnRow } from "../../schema/metadata/primary-key-constraint-column-row";
import { SchemaMetadataRow } from "../../schema/metadata/schema-metadata-row";
import { SequenceMetadataRow } from "../../schema/metadata/sequence-metadata-row";
import { TableColumnMetadataRow } from "../../schema/metadata/table-column-metadata-row";
import { TableMetadataRow } from "../../schema/metadata/table-metadata-row";
import { ViewMetadataRow } from "../../schema/metadata/view-metadata-row";
import {
  createColumnFromMetadataRow,
  mapIndexType,
  mapMatchType,
  mapReferentialAction,
  pickBoolean,
  pickNumber,
  pickString,
} from "../_internal/metadata-provider-utils";
import type { PostgreSQLPlatform } from "../postgre-sql-platform";

type MetadataQueryConnection = Pick<
  Connection,
  "fetchOne" | "fetchAllAssociative" | "fetchAllNumeric" | "fetchFirstColumn"
>;

export class PostgreSQLMetadataProvider implements MetadataProvider {
  public constructor(
    private readonly connection: MetadataQueryConnection,
    readonly _platform: PostgreSQLPlatform,
  ) {}

  public async getAllDatabaseNames(): Promise<DatabaseMetadataRow[]> {
    const names = await this.connection.fetchFirstColumn<string>(
      "SELECT datname FROM pg_database ORDER BY datname",
    );

    return names.map((name) => new DatabaseMetadataRow(String(name)));
  }

  public async getAllSchemaNames(): Promise<SchemaMetadataRow[]> {
    const sql = `SELECT nspname
FROM pg_namespace
WHERE nspname NOT LIKE 'pg\\_%'
  AND nspname != 'information_schema'
ORDER BY nspname`;

    const names = await this.connection.fetchFirstColumn<string>(sql);
    return names.map((name) => new SchemaMetadataRow(String(name)));
  }

  public async getAllTableNames(): Promise<TableMetadataRow[]> {
    const sql = `SELECT n.nspname, c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname NOT LIKE 'pg\\_%'
  AND n.nspname != 'information_schema'
  AND c.relkind IN ('r', 'p')
  AND c.relname NOT IN ('geometry_columns', 'spatial_ref_sys')
ORDER BY n.nspname, c.relname`;

    const rows = await this.connection.fetchAllNumeric<[string, string]>(sql);
    return rows.map((row) => new TableMetadataRow(String(row[0]), String(row[1]), {}));
  }

  public async getTableColumnsForAllTables(): Promise<TableColumnMetadataRow[]> {
    return this.fetchTableColumns(null, null);
  }

  public async getTableColumnsForTable(
    schemaName: string | null,
    tableName: string,
  ): Promise<TableColumnMetadataRow[]> {
    return this.fetchTableColumns(schemaName, tableName);
  }

  public async getIndexColumnsForAllTables(): Promise<IndexColumnMetadataRow[]> {
    return this.fetchIndexColumns(null, null);
  }

  public async getIndexColumnsForTable(
    schemaName: string | null,
    tableName: string,
  ): Promise<IndexColumnMetadataRow[]> {
    return this.fetchIndexColumns(schemaName, tableName);
  }

  public async getPrimaryKeyConstraintColumnsForAllTables(): Promise<
    PrimaryKeyConstraintColumnRow[]
  > {
    return this.fetchPrimaryKeyColumns(null, null);
  }

  public async getPrimaryKeyConstraintColumnsForTable(
    schemaName: string | null,
    tableName: string,
  ): Promise<PrimaryKeyConstraintColumnRow[]> {
    return this.fetchPrimaryKeyColumns(schemaName, tableName);
  }

  public async getForeignKeyConstraintColumnsForAllTables(): Promise<
    ForeignKeyConstraintColumnMetadataRow[]
  > {
    return this.fetchForeignKeyColumns(null, null);
  }

  public async getForeignKeyConstraintColumnsForTable(
    schemaName: string | null,
    tableName: string,
  ): Promise<ForeignKeyConstraintColumnMetadataRow[]> {
    return this.fetchForeignKeyColumns(schemaName, tableName);
  }

  public async getTableOptionsForAllTables(): Promise<TableMetadataRow[]> {
    return (await this.getAllTableNames()).map(
      (table) => new TableMetadataRow(table.getSchemaName(), table.getTableName(), {}),
    );
  }

  public async getTableOptionsForTable(
    schemaName: string | null,
    tableName: string,
  ): Promise<TableMetadataRow[]> {
    return [new TableMetadataRow(schemaName, tableName, {})];
  }

  public async getAllViews(): Promise<ViewMetadataRow[]> {
    const sql = `SELECT schemaname, viewname, definition
FROM pg_views
WHERE schemaname NOT LIKE 'pg\\_%'
  AND schemaname != 'information_schema'
ORDER BY schemaname, viewname`;

    const rows = await this.connection.fetchAllNumeric<[string, string, string]>(sql);
    return rows.map((row) => new ViewMetadataRow(String(row[0]), String(row[1]), String(row[2])));
  }

  public async getAllSequences(): Promise<SequenceMetadataRow[]> {
    const sql = `SELECT sequence_schema, sequence_name, increment, minimum_value
FROM information_schema.sequences
WHERE sequence_catalog = CURRENT_DATABASE()
  AND sequence_schema NOT LIKE 'pg\\_%'
  AND sequence_schema != 'information_schema'
ORDER BY sequence_schema, sequence_name`;

    const rows = await this.connection.fetchAllNumeric<[string, string, number, number]>(sql);
    return rows.map(
      (row) =>
        new SequenceMetadataRow(
          String(row[0]),
          String(row[1]),
          Number(row[2]),
          Number(row[3]),
          null,
        ),
    );
  }

  private async fetchTableColumns(
    schemaName: string | null,
    tableName: string | null,
  ): Promise<TableColumnMetadataRow[]> {
    const sql = `SELECT table_schema,
       table_name,
       COALESCE(NULLIF(data_type, 'USER-DEFINED'), udt_name) AS data_type,
       column_name,
       is_nullable,
       column_default,
       character_maximum_length,
       collation_name,
       numeric_precision,
       numeric_scale
FROM information_schema.columns
WHERE table_schema NOT LIKE 'pg\\_%'
  AND table_schema != 'information_schema'${schemaName === null ? "" : "\n  AND table_schema = ?"}${
    tableName === null ? "" : "\n  AND table_name = ?"
  }
ORDER BY table_schema, table_name, ordinal_position`;
    const params = [
      ...(schemaName === null ? [] : [schemaName]),
      ...(tableName === null ? [] : [tableName]),
    ];
    const rows = await this.connection.fetchAllAssociative(sql, params);

    return rows.map(
      (row) =>
        new TableColumnMetadataRow(
          pickString(row, "table_schema", "TABLE_SCHEMA"),
          pickString(row, "table_name", "TABLE_NAME") ?? "",
          createColumnFromMetadataRow(this._platform, row),
        ),
    );
  }

  private async fetchIndexColumns(
    schemaName: string | null,
    tableName: string | null,
  ): Promise<IndexColumnMetadataRow[]> {
    const sql = `SELECT ns.nspname AS table_schema,
       tbl.relname AS table_name,
       idx.relname AS index_name,
       am.amname AS index_type,
       ind.indisunique AS is_unique,
       ind.indisclustered AS is_clustered,
       pg_get_expr(ind.indpred, ind.indrelid) AS predicate,
       att.attname AS column_name
FROM pg_index ind
JOIN pg_class tbl ON tbl.oid = ind.indrelid
JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
JOIN pg_class idx ON idx.oid = ind.indexrelid
JOIN pg_am am ON am.oid = idx.relam
JOIN LATERAL unnest(ind.indkey) WITH ORDINALITY AS key(attnum, ord) ON TRUE
JOIN pg_attribute att ON att.attrelid = tbl.oid AND att.attnum = key.attnum
WHERE ns.nspname NOT LIKE 'pg\\_%'
  AND ns.nspname != 'information_schema'
  AND ind.indisprimary = FALSE${schemaName === null ? "" : "\n  AND ns.nspname = ?"}${
    tableName === null ? "" : "\n  AND tbl.relname = ?"
  }
ORDER BY ns.nspname, tbl.relname, idx.relname, key.ord`;
    const params = [
      ...(schemaName === null ? [] : [schemaName]),
      ...(tableName === null ? [] : [tableName]),
    ];
    const rows = await this.connection.fetchAllAssociative(sql, params);

    return rows.map(
      (row) =>
        new IndexColumnMetadataRow(
          pickString(row, "table_schema"),
          pickString(row, "table_name") ?? "",
          pickString(row, "index_name") ?? "",
          mapIndexType(row),
          pickBoolean(row, "is_clustered") === true,
          pickString(row, "predicate"),
          pickString(row, "column_name") ?? "",
          pickNumber(row, "column_length", "COLUMN_LENGTH"),
        ),
    );
  }

  private async fetchPrimaryKeyColumns(
    schemaName: string | null,
    tableName: string | null,
  ): Promise<PrimaryKeyConstraintColumnRow[]> {
    const sql = `SELECT tc.table_schema,
       tc.table_name,
       tc.constraint_name,
       kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_schema = kcu.constraint_schema
 AND tc.constraint_name = kcu.constraint_name
 AND tc.table_name = kcu.table_name
WHERE tc.constraint_type = 'PRIMARY KEY'${schemaName === null ? "" : "\n  AND tc.table_schema = ?"}${
      tableName === null ? "" : "\n  AND tc.table_name = ?"
    }
ORDER BY tc.table_schema, tc.table_name, kcu.ordinal_position`;
    const params = [
      ...(schemaName === null ? [] : [schemaName]),
      ...(tableName === null ? [] : [tableName]),
    ];
    const rows = await this.connection.fetchAllAssociative(sql, params);

    return rows.map(
      (row) =>
        new PrimaryKeyConstraintColumnRow(
          pickString(row, "table_schema"),
          pickString(row, "table_name") ?? "",
          pickString(row, "constraint_name"),
          false,
          pickString(row, "column_name") ?? "",
        ),
    );
  }

  private async fetchForeignKeyColumns(
    schemaName: string | null,
    tableName: string | null,
  ): Promise<ForeignKeyConstraintColumnMetadataRow[]> {
    const sql = `SELECT kcu.table_schema,
       kcu.table_name,
       kcu.constraint_name,
       kcu.ordinal_position,
       kcu.column_name,
       ccu.table_schema AS referenced_table_schema,
       ccu.table_name AS referenced_table_name,
       ccu.column_name AS referenced_column_name,
       rc.match_option,
       rc.update_rule,
       rc.delete_rule,
       tc.is_deferrable,
       tc.initially_deferred
FROM information_schema.key_column_usage kcu
JOIN information_schema.table_constraints tc
  ON tc.constraint_schema = kcu.constraint_schema
 AND tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints rc
  ON rc.constraint_schema = tc.constraint_schema
 AND rc.constraint_name = tc.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_schema = rc.unique_constraint_schema
 AND ccu.constraint_name = rc.unique_constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'${schemaName === null ? "" : "\n  AND kcu.table_schema = ?"}${
      tableName === null ? "" : "\n  AND kcu.table_name = ?"
    }
ORDER BY kcu.table_schema, kcu.table_name, kcu.constraint_name, kcu.ordinal_position`;
    const params = [
      ...(schemaName === null ? [] : [schemaName]),
      ...(tableName === null ? [] : [tableName]),
    ];
    const rows = await this.connection.fetchAllAssociative(sql, params);

    return rows.map((row) => {
      const name = pickString(row, "constraint_name");

      return new ForeignKeyConstraintColumnMetadataRow(
        pickString(row, "table_schema"),
        pickString(row, "table_name") ?? "",
        pickNumber(row, "ordinal_position"),
        name,
        pickString(row, "referenced_table_schema"),
        pickString(row, "referenced_table_name") ?? "",
        mapMatchType(pickString(row, "match_option")),
        mapReferentialAction(pickString(row, "update_rule")),
        mapReferentialAction(pickString(row, "delete_rule")),
        pickBoolean(row, "is_deferrable") === true,
        pickBoolean(row, "initially_deferred") === true,
        pickString(row, "column_name") ?? "",
        pickString(row, "referenced_column_name") ?? "",
      );
    });
  }
}
