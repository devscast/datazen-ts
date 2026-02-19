import { LockMode } from "../lock-mode";
import { TransactionIsolationLevel } from "../transaction-isolation-level";
import { Types } from "../types/types";
import { AbstractPlatform } from "./abstract-platform";
import { DateIntervalUnit } from "./date-interval-unit";
import { TrimMode } from "./trim-mode";

export class SQLServerPlatform extends AbstractPlatform {
  protected initializeDatazenTypeMappings(): Record<string, string> {
    return {
      bigint: Types.BIGINT,
      binary: Types.BINARY,
      bit: Types.BOOLEAN,
      blob: Types.BLOB,
      char: Types.STRING,
      date: Types.DATE_MUTABLE,
      datetime: Types.DATETIME_MUTABLE,
      datetime2: Types.DATETIME_MUTABLE,
      datetimeoffset: Types.DATETIMETZ_MUTABLE,
      decimal: Types.DECIMAL,
      double: Types.FLOAT,
      "double precision": Types.FLOAT,
      float: Types.FLOAT,
      image: Types.BLOB,
      int: Types.INTEGER,
      money: Types.INTEGER,
      nchar: Types.STRING,
      ntext: Types.TEXT,
      numeric: Types.DECIMAL,
      nvarchar: Types.STRING,
      real: Types.SMALLFLOAT,
      smalldatetime: Types.DATETIME_MUTABLE,
      smallint: Types.SMALLINT,
      smallmoney: Types.INTEGER,
      sysname: Types.STRING,
      text: Types.TEXT,
      time: Types.TIME_MUTABLE,
      tinyint: Types.SMALLINT,
      uniqueidentifier: Types.GUID,
      varbinary: Types.BINARY,
      varchar: Types.STRING,
      xml: Types.TEXT,
    };
  }

  public getCurrentDateSQL(): string {
    return "CONVERT(date, GETDATE())";
  }

  public getCurrentTimeSQL(): string {
    return "CONVERT(time, GETDATE())";
  }

  protected getDateArithmeticIntervalExpression(
    date: string,
    operator: string,
    interval: string,
    unit: DateIntervalUnit,
  ): string {
    const factor = operator === "-" ? "-1 * " : "";
    return `DATEADD(${unit}, ${factor}${interval}, ${date})`;
  }

  public getDateDiffExpression(date1: string, date2: string): string {
    return `DATEDIFF(day, ${date2}, ${date1})`;
  }

  public supportsIdentityColumns(): boolean {
    return true;
  }

  public supportsReleaseSavepoints(): boolean {
    return false;
  }

  public supportsSchemas(): boolean {
    return true;
  }

  public supportsColumnCollation(): boolean {
    return true;
  }

  public supportsSequences(): boolean {
    return true;
  }

  public getLocateExpression(
    string: string,
    substring: string,
    start: string | null = null,
  ): string {
    if (start === null) {
      return `CHARINDEX(${substring}, ${string})`;
    }

    return `CHARINDEX(${substring}, ${string}, ${start})`;
  }

  public getModExpression(dividend: string, divisor: string): string {
    return `${dividend} % ${divisor}`;
  }

  public getTrimExpression(
    str: string,
    mode: TrimMode = TrimMode.UNSPECIFIED,
    char: string | null = null,
  ): string {
    if (char === null) {
      if (mode === TrimMode.LEADING) {
        return `LTRIM(${str})`;
      }

      if (mode === TrimMode.TRAILING) {
        return `RTRIM(${str})`;
      }

      return `LTRIM(RTRIM(${str}))`;
    }

    const pattern = `'%[^' + ${char} + ']%'`;

    if (mode === TrimMode.LEADING) {
      return `stuff(${str}, 1, patindex(${pattern}, ${str}) - 1, null)`;
    }

    if (mode === TrimMode.TRAILING) {
      return `reverse(stuff(reverse(${str}), 1, patindex(${pattern}, reverse(${str})) - 1, null))`;
    }

    return `reverse(stuff(reverse(stuff(${str}, 1, patindex(${pattern}, ${str}) - 1, null)), 1, patindex(${pattern}, reverse(stuff(${str}, 1, patindex(${pattern}, ${str}) - 1, null))) - 1, null))`;
  }

  public getConcatExpression(...string: string[]): string {
    return `CONCAT(${string.join(", ")})`;
  }

  public getSubstringExpression(
    string: string,
    start: string,
    length: string | null = null,
  ): string {
    if (length === null) {
      return `SUBSTRING(${string}, ${start}, LEN(${string}) - ${start} + 1)`;
    }

    return `SUBSTRING(${string}, ${start}, ${length})`;
  }

  public getLengthExpression(string: string): string {
    return `LEN(${string})`;
  }

  public getCurrentDatabaseExpression(): string {
    return "DB_NAME()";
  }

  public getSetTransactionIsolationSQL(level: TransactionIsolationLevel): string {
    return `SET TRANSACTION ISOLATION LEVEL ${this.getTransactionIsolationLevelSQL(level)}`;
  }

  public getDateTimeFormatString(): string {
    return "Y-m-d H:i:s.u";
  }

  public getDateTimeTzFormatString(): string {
    return "Y-m-d H:i:s.u P";
  }

  public getDateFormatString(): string {
    return "Y-m-d";
  }

  public getTimeFormatString(): string {
    return "H:i:s";
  }

  public getEmptyIdentityInsertSQL(
    quotedTableName: string,
    _quotedIdentifierColumnName: string,
  ): string {
    return `INSERT INTO ${quotedTableName} DEFAULT VALUES`;
  }

  public createSavePoint(savepoint: string): string {
    return `SAVE TRANSACTION ${savepoint}`;
  }

  public releaseSavePoint(_savepoint: string): string {
    return "";
  }

  public rollbackSavePoint(savepoint: string): string {
    return `ROLLBACK TRANSACTION ${savepoint}`;
  }

  public appendLockHint(fromClause: string, lockMode: LockMode): string {
    switch (lockMode) {
      case "none":
      case "optimistic":
        return fromClause;
      case "pessimistic_read":
        return `${fromClause} WITH (HOLDLOCK, ROWLOCK)`;
      case "pessimistic_write":
        return `${fromClause} WITH (UPDLOCK, ROWLOCK)`;
    }
  }

  public convertBooleans(item: unknown): unknown {
    if (Array.isArray(item)) {
      return item.map((value) =>
        typeof value === "boolean" || typeof value === "number" ? Number(Boolean(value)) : value,
      );
    }

    if (typeof item === "boolean" || typeof item === "number") {
      return Number(Boolean(item));
    }

    return item;
  }

  protected doModifyLimitQuery(query: string, limit: number | null, offset: number): string {
    if (limit === null && offset <= 0) {
      return query;
    }

    if (this.shouldAddOrderBy(query)) {
      if (/^SELECT\s+DISTINCT/im.test(query)) {
        // SQL Server won't let us order by a non-selected column in a DISTINCT query,
        // so we have to do this madness. This says, order by the first column in the
        // result. SQL Server's docs say that a nonordered query's result order is non-
        // deterministic anyway, so this won't do anything that a bunch of update and
        // deletes to the table wouldn't do anyway.
        query += " ORDER BY 1";
      } else {
        // In another DBMS, we could do ORDER BY 0, but SQL Server gets angry if you
        // use constant expressions in the order by list.
        query += " ORDER BY (SELECT 0)";
      }
    }

    // This looks somewhat like MYSQL, but limit/offset are in inverse positions
    // Supposedly SQL:2008 core standard.
    // Per TSQL spec, FETCH NEXT n ROWS ONLY is not valid without OFFSET n ROWS.
    query += ` OFFSET ${offset} ROWS`;

    if (limit !== null) {
      query += ` FETCH NEXT ${limit} ROWS ONLY`;
    }

    return query;
  }

  private shouldAddOrderBy(query: string): boolean {
    // Find the position of the last instance of ORDER BY and ensure it is not within a parenthetical statement
    const matches = [...query.matchAll(/\s+order\s+by\s/gi)];
    if (matches.length === 0) {
      return true;
    }

    // ORDER BY instance may be in a subquery after ORDER BY
    // e.g. SELECT col1 FROM test ORDER BY (SELECT col2 from test ORDER BY col2)
    // if in the searched query ORDER BY clause was found where
    // number of open parentheses after the occurrence of the clause is equal to
    // number of closed brackets after the occurrence of the clause,
    // it means that ORDER BY is included in the query being checked
    for (let i = matches.length - 1; i >= 0; i--) {
      const orderByPos = matches[i]!.index!;
      const openBracketsCount = this.countChar(query, "(", orderByPos);
      const closedBracketsCount = this.countChar(query, ")", orderByPos);

      if (openBracketsCount === closedBracketsCount) {
        return false;
      }
    }

    return true;
  }

  /**
   * Helper function to count occurrences of a character after a given index
   */
  private countChar(input: string, char: string, start: number): number {
    let count = 0;
    for (let i = start; i < input.length; i++) {
      if (input[i] === char) {
        count++;
      }
    }
    return count;
  }

  public quoteSingleIdentifier(str: string): string {
    return `[${str.replace(/]/g, "]]")}]`;
  }

  protected getLikeWildcardCharacters(): string {
    return `${super.getLikeWildcardCharacters()}[`;
  }
}
