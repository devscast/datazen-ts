import type { Connection } from "../connection";
import { PostgreSQLSchemaManager } from "../schema/postgre-sql-schema-manager";
import { TransactionIsolationLevel } from "../transaction-isolation-level";
import { Type } from "../types/type";
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
      jsonb: Types.JSONB,
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
    return `(DATE(${date1})-DATE(${date2}))`;
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

  public override getJsonbTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "JSONB";
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

  public override getAlterTableSQL(diff: unknown): string[] {
    const table = this.readTableDiffValue<unknown>(diff, "getOldTable");
    const tableNameSQL = this.readQuotedName(table);
    if (table === undefined || tableNameSQL === null) {
      return super.getAlterTableSQL(diff);
    }

    const sql: string[] = [];
    const commentsSql: string[] = [];

    for (const addedColumn of this.readTableDiffList(diff, "getAddedColumns")) {
      const query = `ADD ${this.getPostgreSqlColumnDeclaration(addedColumn)}`;
      sql.push(`ALTER TABLE ${tableNameSQL} ${query}`);

      const comment = this.readTableDiffValue<string>(addedColumn, "getComment");
      if (typeof comment === "string" && comment.length > 0) {
        const quotedColumnName = this.readQuotedName(addedColumn);
        if (quotedColumnName !== null) {
          commentsSql.push(this.getCommentOnColumnSQL(tableNameSQL, quotedColumnName, comment));
        }
      }
    }

    for (const droppedColumn of this.readTableDiffList(diff, "getDroppedColumns")) {
      const quotedColumnName = this.readQuotedName(droppedColumn);
      if (quotedColumnName !== null) {
        sql.push(`ALTER TABLE ${tableNameSQL} DROP ${quotedColumnName}`);
      }
    }

    for (const columnDiff of this.readTableDiffList(diff, "getChangedColumns")) {
      const oldColumn = this.readTableDiffValue<unknown>(columnDiff, "getOldColumn");
      const newColumn = this.readTableDiffValue<unknown>(columnDiff, "getNewColumn");
      if (oldColumn === undefined || newColumn === undefined) {
        continue;
      }

      const oldColumnName = this.readQuotedName(oldColumn);
      const newColumnName = this.readQuotedName(newColumn);
      if (oldColumnName === null || newColumnName === null) {
        continue;
      }

      if (this.readTableDiffFlag(columnDiff, "hasNameChanged")) {
        sql.push(...this.getRenameColumnSQL(tableNameSQL, oldColumnName, newColumnName));
      }

      const newTypeSQLDeclaration = this.getTypeSQLDeclaration(newColumn);
      const oldTypeSQLDeclaration = this.getTypeSQLDeclaration(oldColumn);
      if (oldTypeSQLDeclaration !== newTypeSQLDeclaration) {
        sql.push(
          `ALTER TABLE ${tableNameSQL} ALTER ${newColumnName} TYPE ${newTypeSQLDeclaration}`,
        );
      }

      if (this.readTableDiffFlag(columnDiff, "hasDefaultChanged")) {
        const newDefault = this.readTableDiffValue<unknown>(newColumn, "getDefault");
        const defaultClause =
          newDefault === null || newDefault === undefined
            ? " DROP DEFAULT"
            : ` SET${this.getDefaultValueDeclarationSQL(this.getColumnArray(newColumn))}`;
        sql.push(`ALTER TABLE ${tableNameSQL} ALTER ${newColumnName}${defaultClause}`);
      }

      if (this.readTableDiffFlag(columnDiff, "hasNotNullChanged")) {
        const notNull = this.readTableDiffValue<boolean>(newColumn, "getNotnull") === true;
        sql.push(
          `ALTER TABLE ${tableNameSQL} ALTER ${newColumnName} ${notNull ? "SET" : "DROP"} NOT NULL`,
        );
      }

      if (this.readTableDiffFlag(columnDiff, "hasAutoIncrementChanged")) {
        const autoincrement =
          this.readTableDiffValue<boolean>(newColumn, "getAutoincrement") === true;
        sql.push(
          `ALTER TABLE ${tableNameSQL} ALTER ${newColumnName} ${
            autoincrement ? "ADD GENERATED BY DEFAULT AS IDENTITY" : "DROP IDENTITY"
          }`,
        );
      }

      if (this.readTableDiffFlag(columnDiff, "hasCommentChanged")) {
        commentsSql.push(
          this.getCommentOnColumnSQL(
            tableNameSQL,
            newColumnName,
            this.readTableDiffValue<string>(newColumn, "getComment") ?? "",
          ),
        );
      }
    }

    if (this.tableDiffHasNonColumnChanges(diff)) {
      sql.push(...this.getAlterTableNonColumnSql(diff));
    }

    return [
      ...this.getPreAlterTableIndexForeignKeySQL(diff),
      ...sql,
      ...commentsSql,
      ...this.getPostAlterTableIndexForeignKeySQL(diff),
    ];
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

  private getTypeSQLDeclaration(column: unknown): string {
    const columnObject = column as {
      getType?: () => Type;
      toArray?: () => Record<string, unknown>;
    };
    const type = columnObject.getType?.();
    if (!(type instanceof Type)) {
      return this.resolveColumnDeclarationFallback(column);
    }

    const columnDefinition = { ...this.getColumnArray(column), autoincrement: false };
    return type.getSQLDeclaration(columnDefinition, this);
  }

  private resolveColumnDeclarationFallback(column: unknown): string {
    const definition = this.getColumnArray(column);
    const type = definition.type;
    if (typeof type === "string") {
      return type.toUpperCase();
    }

    return this.getColumnDeclarationSQL(String(definition.name ?? "column"), definition);
  }

  private getColumnArray(column: unknown): Record<string, unknown> {
    const definition = this.readTableDiffValue<Record<string, unknown>>(column, "toArray") ?? {};
    const quotedName = this.readQuotedName(column);
    if (quotedName !== null) {
      definition.name = quotedName;
    }

    return definition;
  }

  private getPostgreSqlColumnDeclaration(column: unknown): string {
    const definition = this.getColumnArray(column);
    const comment = this.readTableDiffValue<string>(column, "getComment");
    if (typeof comment === "string") {
      definition.comment = comment;
    }

    return this.getColumnDeclarationSQL(String(definition.name ?? ""), definition);
  }

  private getAlterTableNonColumnSql(diff: unknown): string[] {
    return super.getAlterTableSQL({
      ...(diff as Record<string, unknown>),
      addedColumns: [],
      changedColumns: [],
      droppedColumns: [],
      getAddedColumns: () => [],
      getChangedColumns: () => [],
      getDroppedColumns: () => [],
    });
  }

  private tableDiffHasNonColumnChanges(diff: unknown): boolean {
    return (
      this.readTableDiffList(diff, "getAddedIndexes").length > 0 ||
      this.readTableDiffList(diff, "getModifiedIndexes").length > 0 ||
      this.readTableDiffList(diff, "getDroppedIndexes").length > 0 ||
      Object.keys(this.readTableDiffValue<Record<string, unknown>>(diff, "getRenamedIndexes") ?? {})
        .length > 0 ||
      this.readTableDiffList(diff, "getAddedForeignKeys").length > 0 ||
      this.readTableDiffList(diff, "getModifiedForeignKeys").length > 0 ||
      this.readTableDiffList(diff, "getDroppedForeignKeys").length > 0
    );
  }

  private readQuotedName(target: unknown): string | null {
    const quoted = this.readTableDiffValue<string>(target, "getQuotedName", this);
    if (typeof quoted === "string" && quoted.length > 0) {
      return quoted;
    }

    const name = this.readTableDiffValue<string>(target, "getName");
    return typeof name === "string" && name.length > 0 ? this.quoteIdentifier(name) : null;
  }

  private readTableDiffList(target: unknown, methodName: string): unknown[] {
    const value = this.readTableDiffValue<unknown>(target, methodName);
    return Array.isArray(value) ? value : [];
  }

  private readTableDiffFlag(target: unknown, methodName: string): boolean {
    return this.readTableDiffValue<boolean>(target, methodName) === true;
  }

  private readTableDiffValue<T>(
    target: unknown,
    methodName: string,
    ...args: unknown[]
  ): T | undefined {
    if (target === null || target === undefined || typeof target !== "object") {
      return undefined;
    }

    const candidate = target as Record<string, unknown>;
    const fn = candidate[methodName];
    if (typeof fn === "function") {
      return (fn as (...callArgs: unknown[]) => T).apply(target, args);
    }

    return candidate[methodName] as T | undefined;
  }
}
