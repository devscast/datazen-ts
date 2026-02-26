import type { Connection } from "../connection";
import { ColumnValuesRequired } from "../exception/invalid-column-type/column-values-required";
import { MySQLSchemaManager } from "../schema/mysql-schema-manager";
import type { TableDiff } from "../schema/table-diff";
import { DefaultSelectSQLBuilder } from "../sql/builder/default-select-sql-builder";
import { SelectSQLBuilder } from "../sql/builder/select-sql-builder";
import { TransactionIsolationLevel } from "../transaction-isolation-level";
import { Types } from "../types/types";
import { AbstractPlatform } from "./abstract-platform";
import { DateIntervalUnit } from "./date-interval-unit";
import type { KeywordList } from "./keywords/keyword-list";
import { MySQLKeywords } from "./keywords/mysql-keywords";

export abstract class AbstractMySQLPlatform extends AbstractPlatform {
  public override getCreateTableSQL(table: {
    getColumns(): readonly unknown[];
    getName(): string;
  }): string[] {
    return this.appendMySQLTableOptions(super.getCreateTableSQL(table), table);
  }

  protected override getCreateTableWithoutForeignKeysSQL(table: unknown): string[] {
    return this.appendMySQLTableOptions(super.getCreateTableWithoutForeignKeysSQL(table), table);
  }

  protected initializeDatazenTypeMappings(): Record<string, string> {
    return {
      bigint: Types.BIGINT,
      binary: Types.BINARY,
      blob: Types.BLOB,
      char: Types.STRING,
      date: Types.DATE_MUTABLE,
      datetime: Types.DATETIME_MUTABLE,
      decimal: Types.DECIMAL,
      double: Types.FLOAT,
      enum: Types.ENUM,
      float: Types.SMALLFLOAT,
      int: Types.INTEGER,
      integer: Types.INTEGER,
      json: Types.JSON,
      longblob: Types.BLOB,
      longtext: Types.TEXT,
      mediumblob: Types.BLOB,
      mediumint: Types.INTEGER,
      mediumtext: Types.TEXT,
      numeric: Types.DECIMAL,
      real: Types.FLOAT,
      set: Types.SIMPLE_ARRAY,
      smallint: Types.SMALLINT,
      string: Types.STRING,
      text: Types.TEXT,
      time: Types.TIME_MUTABLE,
      timestamp: Types.DATETIME_MUTABLE,
      tinyblob: Types.BLOB,
      tinyint: Types.BOOLEAN,
      tinytext: Types.TEXT,
      varbinary: Types.BINARY,
      varchar: Types.STRING,
      year: Types.DATE_MUTABLE,
    };
  }

  public override getBooleanTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "TINYINT";
  }

  public override getIntegerTypeDeclarationSQL(column: Record<string, unknown>): string {
    return `INT${this._getCommonIntegerTypeDeclarationSQL(column)}`;
  }

  public override getBigIntTypeDeclarationSQL(column: Record<string, unknown>): string {
    return `BIGINT${this._getCommonIntegerTypeDeclarationSQL(column)}`;
  }

  public override getEnumDeclarationSQL(column: Record<string, unknown>): string {
    const values = column.values;
    if (!Array.isArray(values) || values.length === 0) {
      throw ColumnValuesRequired.new(this, "ENUM");
    }

    return `ENUM(${values.map((value) => this.quoteStringLiteral(String(value))).join(", ")})`;
  }

  public override getSmallIntTypeDeclarationSQL(column: Record<string, unknown>): string {
    return `SMALLINT${this._getCommonIntegerTypeDeclarationSQL(column)}`;
  }

  protected override _getCommonIntegerTypeDeclarationSQL(column: Record<string, unknown>): string {
    let sql = "";

    if (column.unsigned === true) {
      sql += " UNSIGNED";
    }

    if (column.autoincrement === true) {
      sql += " AUTO_INCREMENT";
    }

    return sql;
  }

  protected doModifyLimitQuery(query: string, limit: number | null, offset: number): string {
    if (limit !== null) {
      query += ` LIMIT ${limit}`;

      if (offset > 0) {
        query += ` OFFSET ${offset}`;
      }
    } else if (offset > 0) {
      // 2^64-1 is the maximum of unsigned BIGINT, the biggest limit possible
      query += ` LIMIT 18446744073709551615 OFFSET ${offset}`;
    }

    return query;
  }

  public quoteSingleIdentifier(str: string): string {
    return `\`${str.replace(/`/g, "``")}\``;
  }

  public quoteStringLiteral(str: string): string {
    return super.quoteStringLiteral(str.replace(/\\/g, "\\\\"));
  }

  public getRegexpExpression(): string {
    return "RLIKE";
  }

  public getLocateExpression(
    string: string,
    substring: string,
    start: string | null = null,
  ): string {
    if (start === null) {
      return `LOCATE(${substring}, ${string})`;
    }

    return `LOCATE(${substring}, ${string}, ${start})`;
  }

  public getConcatExpression(...string: string[]): string {
    return `CONCAT(${string.join(", ")})`;
  }

  protected getDateArithmeticIntervalExpression(
    date: string,
    operator: string,
    interval: string,
    unit: DateIntervalUnit,
  ): string {
    const fn = operator === "+" ? "DATE_ADD" : "DATE_SUB";
    return `${fn}(${date}, INTERVAL ${interval} ${unit})`;
  }

  public getDateDiffExpression(date1: string, date2: string): string {
    return `DATEDIFF(${date1}, ${date2})`;
  }

  public getCurrentDatabaseExpression(): string {
    return "DATABASE()";
  }

  public getLengthExpression(string: string): string {
    return `CHAR_LENGTH(${string})`;
  }

  public getSetTransactionIsolationSQL(level: TransactionIsolationLevel): string {
    return `SET SESSION TRANSACTION ISOLATION LEVEL ${this.getTransactionIsolationLevelSQL(level)}`;
  }

  public getDefaultTransactionIsolationLevel(): TransactionIsolationLevel {
    return TransactionIsolationLevel.REPEATABLE_READ;
  }

  public supportsIdentityColumns(): boolean {
    return true;
  }

  public supportsInlineColumnComments(): boolean {
    return true;
  }

  public supportsColumnCollation(): boolean {
    return true;
  }

  protected createReservedKeywordsList(): KeywordList {
    return new MySQLKeywords();
  }

  public createSchemaManager(connection: Connection): MySQLSchemaManager {
    return new MySQLSchemaManager(connection, this);
  }

  public createSelectSQLBuilder(): SelectSQLBuilder {
    return new DefaultSelectSQLBuilder(this, "FOR UPDATE", null);
  }

  public override getDropTemporaryTableSQL(table: string): string {
    return `DROP TEMPORARY TABLE ${table}`;
  }

  public override getAlterTableSQL(diff: unknown): string[] {
    const tableDiff = diff as TableDiff;
    const oldTable = this.readTableDiffTable(tableDiff, "getOldTable");
    if (oldTable === null) {
      return super.getAlterTableSQL(diff);
    }

    const tableName = this.readTableQuotedName(oldTable);
    if (tableName === null) {
      return super.getAlterTableSQL(diff);
    }

    const addedColumns = this.readTableDiffColumns(tableDiff, "getAddedColumns");
    const droppedColumns = this.readTableDiffColumns(tableDiff, "getDroppedColumns");
    const changedColumns = this.readTableDiffColumnDiffs(tableDiff);

    if (addedColumns.length === 0 && droppedColumns.length === 0 && changedColumns.length === 0) {
      return super.getAlterTableSQL(diff);
    }

    const queryParts: string[] = [];

    for (const column of addedColumns) {
      queryParts.push(`ADD ${this.getMySqlColumnDeclaration(column)}`);
    }

    for (const column of droppedColumns) {
      const quotedName = this.readQuotedName(column);
      if (quotedName !== null) {
        queryParts.push(`DROP ${quotedName}`);
      }
    }

    for (const columnDiff of changedColumns) {
      const oldColumn = this.readValue<unknown>(columnDiff, "getOldColumn");
      const newColumn = this.readValue<unknown>(columnDiff, "getNewColumn");
      if (oldColumn === undefined || newColumn === undefined) {
        continue;
      }

      const oldColumnName = this.readQuotedName(oldColumn);
      const newColumnDeclaration = this.getMySqlColumnDeclaration(newColumn);
      if (oldColumnName === null || newColumnDeclaration.length === 0) {
        continue;
      }

      queryParts.push(`CHANGE ${oldColumnName} ${newColumnDeclaration}`);
    }

    const sql = [...this.getPreAlterTableIndexForeignKeySQL(diff)];

    if (queryParts.length > 0) {
      sql.push(`ALTER TABLE ${tableName} ${queryParts.join(", ")}`);
    }

    const nonColumnSql = this.getAlterTableNonColumnSql(diff);
    if (nonColumnSql.length > 0) {
      sql.push(...nonColumnSql);
    }

    sql.push(...this.getPostAlterTableIndexForeignKeySQL(diff));
    return sql;
  }

  private appendMySQLTableOptions(sql: string[], table: unknown): string[] {
    if (sql.length === 0) {
      return sql;
    }

    const options = this.readTableOptions(table);
    const charset = options.charset;

    if (typeof charset === "string" && charset.length > 0) {
      sql[0] = `${sql[0]} DEFAULT CHARACTER SET ${charset}`;
    }

    return sql;
  }

  private readTableOptions(table: unknown): Record<string, unknown> {
    if (table === null || typeof table !== "object") {
      return {};
    }

    const getOptions = (table as { getOptions?: () => unknown }).getOptions;
    if (typeof getOptions !== "function") {
      return {};
    }

    const options = getOptions.call(table);
    return options !== null && typeof options === "object"
      ? { ...(options as Record<string, unknown>) }
      : {};
  }

  private getMySqlColumnDeclaration(column: unknown): string {
    const definition = this.readValue<Record<string, unknown>>(column, "toArray") ?? {};
    const quotedName = this.readQuotedName(column);
    if (quotedName !== null) {
      definition.name = quotedName;
    }

    const comment = this.readValue<string>(column, "getComment");
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
      getAddedForeignKeys: () => this.readTableDiffColumns(diff, "getAddedForeignKeys"),
      getAddedIndexes: () => this.readTableDiffColumns(diff, "getAddedIndexes"),
      getChangedColumns: () => [],
      getDroppedColumns: () => [],
      getDroppedForeignKeys: () => this.readTableDiffColumns(diff, "getDroppedForeignKeys"),
      getDroppedIndexes: () => this.readTableDiffColumns(diff, "getDroppedIndexes"),
      getModifiedForeignKeys: () => this.readTableDiffColumns(diff, "getModifiedForeignKeys"),
      getModifiedIndexes: () => this.readTableDiffColumns(diff, "getModifiedIndexes"),
      getRenamedIndexes: () =>
        this.readValue<Record<string, unknown>>(diff, "getRenamedIndexes") ?? {},
    });
  }

  private readTableDiffColumns(diff: unknown, methodName: string): unknown[] {
    const value = this.readValue<unknown>(diff, methodName);
    return Array.isArray(value) ? value : [];
  }

  private readTableDiffColumnDiffs(diff: unknown): unknown[] {
    return this.readTableDiffColumns(diff, "getChangedColumns");
  }

  private readTableDiffTable(diff: unknown, methodName: string): unknown | null {
    const value = this.readValue<unknown>(diff, methodName);
    return value ?? null;
  }

  private readTableQuotedName(table: unknown): string | null {
    const quoted = this.readValue<string>(table, "getQuotedName", this);
    if (typeof quoted === "string" && quoted.length > 0) {
      return quoted;
    }

    const name = this.readValue<string>(table, "getName");
    return typeof name === "string" && name.length > 0 ? name : null;
  }

  private readQuotedName(column: unknown): string | null {
    const quoted = this.readValue<string>(column, "getQuotedName", this);
    if (typeof quoted === "string" && quoted.length > 0) {
      return quoted;
    }

    const name = this.readValue<string>(column, "getName");
    return typeof name === "string" && name.length > 0 ? this.quoteIdentifier(name) : null;
  }

  private readValue<T>(target: unknown, methodName: string, ...args: unknown[]): T | undefined {
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
