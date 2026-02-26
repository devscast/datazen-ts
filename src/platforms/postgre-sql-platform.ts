import type { Connection } from "../connection";
import { PostgreSQLSchemaManager } from "../schema/postgre-sql-schema-manager";
import { TransactionIsolationLevel } from "../transaction-isolation-level";
import { Types } from "../types/types";
import { AbstractPlatform } from "./abstract-platform";
import { DateIntervalUnit } from "./date-interval-unit";
import type { KeywordList } from "./keywords/keyword-list";
import { PostgreSQLKeywords } from "./keywords/postgresql-keywords";
import { PostgreSQLMetadataProvider } from "./postgresql/postgre-sql-metadata-provider";

export class PostgreSQLPlatform extends AbstractPlatform {
  protected useBooleanTrueFalseStrings = false;

  protected override _getCreateTableSQL(
    name: string,
    columns: Array<Record<string, unknown>>,
    options: Record<string, unknown> = {},
  ): string[] {
    this.validateCreateTableOptions(options, "_getCreateTableSQL");

    let columnListSql = this.getColumnDeclarationListSQL(columns);

    const primary = Array.isArray(options.primary) ? options.primary.map(String) : [];
    if (primary.length > 0) {
      columnListSql += `, PRIMARY KEY (${[...new Set(primary)].join(", ")})`;
    }

    const unlogged = options.unlogged === true ? " UNLOGGED" : "";
    const sql = [`CREATE${unlogged} TABLE ${name} (${columnListSql})`];

    const indexes = Array.isArray(options.indexes) ? (options.indexes as unknown[]) : [];
    for (const index of indexes) {
      sql.push(this.getCreateIndexSQL(index, name));
    }

    const uniqueConstraints = Array.isArray(options.uniqueConstraints)
      ? (options.uniqueConstraints as unknown[])
      : [];
    for (const uniqueConstraint of uniqueConstraints) {
      sql.push(this.getCreateUniqueConstraintSQL(uniqueConstraint, name));
    }

    const foreignKeys = Array.isArray(options.foreignKeys)
      ? (options.foreignKeys as unknown[])
      : [];
    for (const definition of foreignKeys) {
      sql.push(this.getCreateForeignKeySQL(definition, name));
    }

    return sql;
  }

  protected initializeDatazenTypeMappings(): Record<string, string> {
    return {
      bigint: Types.BIGINT,
      bigserial: Types.BIGINT,
      bool: Types.BOOLEAN,
      boolean: Types.BOOLEAN,
      bytea: Types.BINARY,
      char: Types.STRING,
      date: Types.DATE_MUTABLE,
      "double precision": Types.FLOAT,
      float4: Types.SMALLFLOAT,
      float8: Types.FLOAT,
      int: Types.INTEGER,
      int2: Types.SMALLINT,
      int4: Types.INTEGER,
      int8: Types.BIGINT,
      integer: Types.INTEGER,
      json: Types.JSON,
      jsonb: Types.JSON,
      numeric: Types.DECIMAL,
      real: Types.SMALLFLOAT,
      serial: Types.INTEGER,
      smallint: Types.SMALLINT,
      text: Types.TEXT,
      time: Types.TIME_MUTABLE,
      timestamp: Types.DATETIME_MUTABLE,
      timestamptz: Types.DATETIMETZ_MUTABLE,
      timetz: Types.DATETIMETZ_MUTABLE,
      uuid: Types.GUID,
      varchar: Types.STRING,
    };
  }

  public getLocateExpression(
    string: string,
    substring: string,
    start: string | null = null,
  ): string {
    if (start !== null) {
      const sliced = this.getSubstringExpression(string, start);
      return `CASE WHEN (POSITION(${substring} IN ${sliced}) = 0) THEN 0 ELSE (POSITION(${substring} IN ${sliced}) + ${start} - 1) END`;
    }

    return `POSITION(${substring} IN ${string})`;
  }

  protected override getDateArithmeticIntervalExpression(
    date: string,
    operator: string,
    interval: string,
    unit: DateIntervalUnit,
  ): string {
    if (unit === DateIntervalUnit.QUARTER) {
      interval = this.multiplyInterval(interval, 3);
      unit = DateIntervalUnit.MONTH;
    }

    return `(${date} ${operator} (${interval} || ' ${unit}')::interval)`;
  }

  public getDateDiffExpression(date1: string, date2: string): string {
    return `DATE_PART('day', (${date1})::timestamp - (${date2})::timestamp)`;
  }

  public getCurrentDatabaseExpression(): string {
    return "CURRENT_DATABASE()";
  }

  public getSetTransactionIsolationSQL(level: TransactionIsolationLevel): string {
    return `SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL ${this.getTransactionIsolationLevelSQL(level)}`;
  }

  public supportsSchemas(): boolean {
    return true;
  }

  public supportsSequences(): boolean {
    return true;
  }

  public supportsIdentityColumns(): boolean {
    return true;
  }

  public override getBooleanTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "BOOLEAN";
  }

  public override getGuidTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "UUID";
  }

  public override getDateTimeTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "TIMESTAMP(0) WITHOUT TIME ZONE";
  }

  public override getDateTimeTzTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "TIMESTAMP(0) WITH TIME ZONE";
  }

  public override getTimeTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "TIME(0) WITHOUT TIME ZONE";
  }

  public override getClobTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "TEXT";
  }

  public override getBlobTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "BYTEA";
  }

  protected override getBinaryTypeDeclarationSQLSnippet(_length: number | undefined): string {
    return "BYTEA";
  }

  protected override getVarbinaryTypeDeclarationSQLSnippet(_length: number | undefined): string {
    return "BYTEA";
  }

  public override getIntegerTypeDeclarationSQL(column: Record<string, unknown>): string {
    return `INT${this._getCommonIntegerTypeDeclarationSQL(column)}`;
  }

  public override getBigIntTypeDeclarationSQL(column: Record<string, unknown>): string {
    return `BIGINT${this._getCommonIntegerTypeDeclarationSQL(column)}`;
  }

  public override getSmallIntTypeDeclarationSQL(column: Record<string, unknown>): string {
    return `SMALLINT${this._getCommonIntegerTypeDeclarationSQL(column)}`;
  }

  protected override _getCommonIntegerTypeDeclarationSQL(column: Record<string, unknown>): string {
    return column.autoincrement === true ? " GENERATED BY DEFAULT AS IDENTITY" : "";
  }

  public override getDefaultValueDeclarationSQL(column: Record<string, unknown>): string {
    if (column.autoincrement === true) {
      return "";
    }

    return super.getDefaultValueDeclarationSQL(column);
  }

  public setUseBooleanTrueFalseStrings(flag: boolean): void {
    this.useBooleanTrueFalseStrings = flag;
  }

  public getDefaultColumnValueSQLSnippet(): string {
    return [
      "SELECT",
      "    pg_get_expr(adbin, adrelid)",
      " FROM pg_attrdef",
      " WHERE c.oid = pg_attrdef.adrelid",
      "    AND pg_attrdef.adnum=a.attnum",
    ].join("\n");
  }

  protected createReservedKeywordsList(): KeywordList {
    return new PostgreSQLKeywords();
  }

  public createSchemaManager(connection: Connection): PostgreSQLSchemaManager {
    return new PostgreSQLSchemaManager(connection, this);
  }

  public override createMetadataProvider(connection: Connection): PostgreSQLMetadataProvider {
    return new PostgreSQLMetadataProvider(connection, this);
  }

  private convertSingleBooleanValue(
    value: unknown,
    callback: (booleanValue: boolean) => unknown,
  ): unknown {
    if (typeof value === "boolean") {
      return callback(value);
    }

    if (value === 0 || value === 1) {
      return callback(value === 1);
    }

    return value;
  }

  private doConvertBooleans(item: unknown, callback: (booleanValue: boolean) => unknown): unknown {
    if (Array.isArray(item)) {
      return item.map((value) => this.doConvertBooleans(value, callback));
    }

    return this.convertSingleBooleanValue(item, callback);
  }
}
