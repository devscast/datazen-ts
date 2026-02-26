import type { Connection } from "../connection";
import { SQLiteSchemaManager } from "../schema/sqlite-schema-manager";
import { TransactionIsolationLevel } from "../transaction-isolation-level";
import { Types } from "../types/types";
import { AbstractPlatform } from "./abstract-platform";
import { DateIntervalUnit } from "./date-interval-unit";
import { NotSupported } from "./exception/not-supported";
import type { KeywordList } from "./keywords/keyword-list";
import { SQLiteKeywords } from "./keywords/sqlite-keywords";
import { SQLiteMetadataProvider } from "./sqlite/sqlite-metadata-provider";
import { TrimMode } from "./trim-mode";

export class SQLitePlatform extends AbstractPlatform {
  protected initializeDatazenTypeMappings(): Record<string, string> {
    return {
      bigint: Types.BIGINT,
      blob: Types.BLOB,
      boolean: Types.BOOLEAN,
      char: Types.STRING,
      date: Types.DATE_MUTABLE,
      datetime: Types.DATETIME_MUTABLE,
      decimal: Types.DECIMAL,
      double: Types.FLOAT,
      float: Types.FLOAT,
      int: Types.INTEGER,
      integer: Types.INTEGER,
      numeric: Types.DECIMAL,
      real: Types.FLOAT,
      text: Types.TEXT,
      time: Types.TIME_MUTABLE,
      timestamp: Types.DATETIME_MUTABLE,
      varchar: Types.STRING,
    };
  }

  public getLocateExpression(
    string: string,
    substring: string,
    start: string | null = null,
  ): string {
    if (start === null || start === "1") {
      return `INSTR(${string}, ${substring})`;
    }

    return (
      `CASE WHEN INSTR(SUBSTR(${string}, ${start}), ${substring}) > 0 ` +
      `THEN INSTR(SUBSTR(${string}, ${start}), ${substring}) + ${start} - 1 ELSE 0 END`
    );
  }

  public override getTrimExpression(
    str: string,
    mode: TrimMode = TrimMode.UNSPECIFIED,
    char: string | null = null,
  ): string {
    const trimFunction =
      mode === TrimMode.LEADING ? "LTRIM" : mode === TrimMode.TRAILING ? "RTRIM" : "TRIM";

    if (char === null) {
      return `${trimFunction}(${str})`;
    }

    return `${trimFunction}(${str}, ${char})`;
  }

  public getSubstringExpression(
    string: string,
    start: string,
    length: string | null = null,
  ): string {
    if (length === null) {
      return `SUBSTR(${string}, ${start})`;
    }

    return `SUBSTR(${string}, ${start}, ${length})`;
  }

  public getDateDiffExpression(date1: string, date2: string): string {
    return `CAST((JULIANDAY(${date1}) - JULIANDAY(${date2})) AS INTEGER)`;
  }

  public getCurrentDateSQL(): string {
    return "DATE('now')";
  }

  public getCurrentTimeSQL(): string {
    return "TIME('now')";
  }

  protected override getDateArithmeticIntervalExpression(
    date: string,
    operator: string,
    interval: string,
    unit: DateIntervalUnit,
  ): string {
    let mappedInterval = interval;
    let mappedUnit = unit;

    if (mappedUnit === DateIntervalUnit.WEEK) {
      mappedInterval = this.multiplyInterval(mappedInterval, 7);
      mappedUnit = DateIntervalUnit.DAY;
    } else if (mappedUnit === DateIntervalUnit.QUARTER) {
      mappedInterval = this.multiplyInterval(mappedInterval, 3);
      mappedUnit = DateIntervalUnit.MONTH;
    }

    return `DATETIME(${date}, ${this.getConcatExpression(
      this.quoteStringLiteral(operator),
      mappedInterval,
      this.quoteStringLiteral(` ${mappedUnit}`),
    )})`;
  }

  public override getTruncateTableSQL(tableName: string, _cascade = false): string {
    return `DELETE FROM ${this.quoteIdentifier(tableName)}`;
  }

  public override getCreateForeignKeySQL(): string {
    throw NotSupported.new("getCreateForeignKeySQL");
  }

  public override getDropForeignKeySQL(): string {
    throw NotSupported.new("getDropForeignKeySQL");
  }

  public override getIntegerTypeDeclarationSQL(column: Record<string, unknown>): string {
    return `INTEGER${this._getCommonIntegerTypeDeclarationSQL(column)}`;
  }

  public override getBigIntTypeDeclarationSQL(column: Record<string, unknown>): string {
    if (hasAutoIncrementFlag(column)) {
      return this.getIntegerTypeDeclarationSQL(column);
    }

    return `BIGINT${this._getCommonIntegerTypeDeclarationSQL(column)}`;
  }

  public override getSmallIntTypeDeclarationSQL(column: Record<string, unknown>): string {
    if (hasAutoIncrementFlag(column)) {
      return this.getIntegerTypeDeclarationSQL(column);
    }

    return `SMALLINT${this._getCommonIntegerTypeDeclarationSQL(column)}`;
  }

  protected override _getCommonIntegerTypeDeclarationSQL(column: Record<string, unknown>): string {
    if (hasAutoIncrementFlag(column)) {
      return " PRIMARY KEY AUTOINCREMENT";
    }

    return column.unsigned === true ? " UNSIGNED" : "";
  }

  public getSetTransactionIsolationSQL(_level: TransactionIsolationLevel): string {
    throw NotSupported.new("setTransactionIsolation");
  }

  public supportsIdentityColumns(): boolean {
    return true;
  }

  public override getCreateTableSQL(table: {
    getColumns(): readonly unknown[];
    getName(): string;
  }): string[] {
    return this.buildSQLiteCreateTableSQL(table, true);
  }

  protected override getCreateTableWithoutForeignKeysSQL(table: unknown): string[] {
    return this.buildSQLiteCreateTableSQL(table, false);
  }

  public override getCreateTablesSQL(tables: Iterable<unknown>): string[] {
    const sql: string[] = [];

    for (const table of tables) {
      sql.push(
        ...this.getCreateTableSQL(table as { getColumns(): readonly unknown[]; getName(): string }),
      );
    }

    return sql;
  }

  protected createReservedKeywordsList(): KeywordList {
    return new SQLiteKeywords();
  }

  public createSchemaManager(connection: Connection): SQLiteSchemaManager {
    return new SQLiteSchemaManager(connection, this);
  }

  public override createMetadataProvider(connection: Connection): SQLiteMetadataProvider {
    return new SQLiteMetadataProvider(connection, this);
  }

  private buildSQLiteCreateTableSQL(table: unknown, createForeignKeys: boolean): string[] {
    const createTableLike = this.asSQLiteCreateTableLike(table);
    this.assertCreateTableHasColumns(createTableLike);

    const tableName = this.getSQLiteDynamicTableSQLName(table);
    const columns = createTableLike
      .getColumns()
      .map((column) => this.columnToSQLiteCreateTableArray(column));
    let columnListSql = this.getColumnDeclarationListSQL(columns);

    const indexes = this.sqliteInvoke<unknown[]>(table, "getIndexes") ?? [];
    let primaryColumns: string[] = [];
    const indexSql: string[] = [];

    for (const index of indexes) {
      if (this.sqliteInvoke<boolean>(index, "isPrimary") === true) {
        primaryColumns = this.getSQLiteQuotedColumns(index);
        continue;
      }

      if (this.sqliteInvoke<boolean>(index, "isUnique") === true) {
        columnListSql += `, ${this.getUniqueConstraintDeclarationSQL(index)}`;
        continue;
      }

      indexSql.push(this.getCreateIndexSQL(index, tableName));
    }

    if (primaryColumns.length > 0 && !columns.some((column) => hasAutoIncrementFlag(column))) {
      columnListSql += `, PRIMARY KEY (${[...new Set(primaryColumns)].join(", ")})`;
    }

    if (createForeignKeys) {
      const foreignKeys = this.sqliteInvoke<unknown[]>(table, "getForeignKeys") ?? [];
      for (const foreignKey of foreignKeys) {
        columnListSql += `, ${this.getForeignKeyDeclarationSQL(foreignKey)}`;
      }
    }

    const check = this.getCheckDeclarationSQL(columns);
    let query = `CREATE TABLE ${tableName} (${columnListSql}`;
    if (check.length > 0) {
      query += `, ${check}`;
    }
    query += ")";

    return [query, ...indexSql];
  }

  private asSQLiteCreateTableLike(table: unknown): {
    getColumns(): readonly unknown[];
    getName(): string;
  } {
    const columns = this.sqliteInvoke<unknown[]>(table, "getColumns");
    const name = this.sqliteInvoke<string>(table, "getName");

    if (columns === undefined || name === undefined) {
      throw NotSupported.new("getCreateTableSQL");
    }

    return {
      getColumns: () => columns,
      getName: () => name,
    };
  }

  private columnToSQLiteCreateTableArray(column: unknown): Record<string, unknown> {
    const definition =
      this.sqliteInvoke<Record<string, unknown>>(column, "toArray") ??
      (column !== null && typeof column === "object"
        ? { ...(column as Record<string, unknown>) }
        : {});

    const quotedName = this.sqliteInvoke<string>(column, "getQuotedName", this);
    if (quotedName !== undefined) {
      definition.name = quotedName;
    } else if (definition.name !== undefined) {
      definition.name = String(definition.name);
    }

    const comment = this.sqliteInvoke<string>(column, "getComment");
    if (comment !== undefined) {
      definition.comment = comment;
    }

    return definition;
  }

  private getSQLiteDynamicTableSQLName(table: unknown): string {
    return (
      this.sqliteInvoke<string>(table, "getQuotedName", this) ??
      this.sqliteInvoke<string>(table, "getName") ??
      String(table)
    );
  }

  private getSQLiteQuotedColumns(target: unknown): string[] {
    const quoted = this.sqliteInvoke<string[]>(target, "getQuotedColumns", this);
    if (Array.isArray(quoted)) {
      return quoted;
    }

    const columns = this.sqliteInvoke<string[]>(target, "getColumns");
    return Array.isArray(columns) ? columns.map((column) => String(column)) : [];
  }

  private sqliteInvoke<T>(target: unknown, methodName: string, ...args: unknown[]): T | undefined {
    if (target === null || typeof target !== "object") {
      return undefined;
    }

    const fn = (target as Record<string, unknown>)[methodName];
    if (typeof fn !== "function") {
      return undefined;
    }

    return (fn as (...callArgs: unknown[]) => T).apply(target, args);
  }
}

function hasAutoIncrementFlag(column: Record<string, unknown>): boolean {
  return column.autoincrement === true;
}
