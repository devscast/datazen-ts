import type { DatabaseMetadataRow } from "./database-metadata-row";
import type { ForeignKeyConstraintColumnMetadataRow } from "./foreign-key-constraint-column-metadata-row";
import type { IndexColumnMetadataRow } from "./index-column-metadata-row";
import type { PrimaryKeyConstraintColumnRow } from "./primary-key-constraint-column-row";
import type { SchemaMetadataRow } from "./schema-metadata-row";
import type { SequenceMetadataRow } from "./sequence-metadata-row";
import type { TableColumnMetadataRow } from "./table-column-metadata-row";
import type { TableMetadataRow } from "./table-metadata-row";
import type { ViewMetadataRow } from "./view-metadata-row";

export interface MetadataProvider {
  getAllDatabaseNames(): Iterable<DatabaseMetadataRow>;
  getAllSchemaNames(): Iterable<SchemaMetadataRow>;
  getAllTableNames(): Iterable<TableMetadataRow>;
  getTableColumnsForAllTables(): Iterable<TableColumnMetadataRow>;
  getTableColumnsForTable(
    schemaName: string | null,
    tableName: string,
  ): Iterable<TableColumnMetadataRow>;
  getIndexColumnsForAllTables(): Iterable<IndexColumnMetadataRow>;
  getIndexColumnsForTable(
    schemaName: string | null,
    tableName: string,
  ): Iterable<IndexColumnMetadataRow>;
  getPrimaryKeyConstraintColumnsForAllTables(): Iterable<PrimaryKeyConstraintColumnRow>;
  getPrimaryKeyConstraintColumnsForTable(
    schemaName: string | null,
    tableName: string,
  ): Iterable<PrimaryKeyConstraintColumnRow>;
  getForeignKeyConstraintColumnsForAllTables(): Iterable<ForeignKeyConstraintColumnMetadataRow>;
  getForeignKeyConstraintColumnsForTable(
    schemaName: string | null,
    tableName: string,
  ): Iterable<ForeignKeyConstraintColumnMetadataRow>;
  getTableOptionsForAllTables(): Iterable<TableMetadataRow>;
  getTableOptionsForTable(schemaName: string | null, tableName: string): Iterable<TableMetadataRow>;
  getAllViews(): Iterable<ViewMetadataRow>;
  getAllSequences(): Iterable<SequenceMetadataRow>;
}
