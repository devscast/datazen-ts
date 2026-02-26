import type { Connection } from "../connection";
import { MySQLSchemaManager } from "../schema/mysql-schema-manager";
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
}
