import { LockMode } from "../lock-mode";
import { DefaultSelectSQLBuilder } from "../sql/builder/default-select-sql-builder";
import { DefaultUnionSQLBuilder } from "../sql/builder/default-union-sql-builder";
import { SelectSQLBuilder } from "../sql/builder/select-sql-builder";
import { UnionSQLBuilder } from "../sql/builder/union-sql-builder";
import { WithSQLBuilder } from "../sql/builder/with-sql-builder";
import { TransactionIsolationLevel } from "../transaction-isolation-level";
import { DateIntervalUnit } from "./date-interval-unit";
import { NotSupported } from "./exception/not-supported";
import { TrimMode } from "./trim-mode";

export abstract class AbstractPlatform {
  private datazenTypeMapping: Record<string, string> | null = null;

  /**
   * Quotes an identifier preserving dotted qualification.
   */
  public quoteIdentifier(identifier: string): string {
    return identifier
      .split(".")
      .map((part) => this.quoteSingleIdentifier(part))
      .join(".");
  }

  /**
   * Quotes a single identifier (no dot chain separation).
   */
  public quoteSingleIdentifier(str: string): string {
    return `"${str.replace(/"/g, `""`)}"`;
  }

  /**
   * Adds a driver-specific LIMIT clause to the query.
   */
  public modifyLimitQuery(query: string, limit: number | null, offset: number = 0): string {
    if (offset < 0) {
      throw new Error(`Offset must be a positive integer or zero, ${offset} given.`);
    }

    return this.doModifyLimitQuery(query, limit, offset);
  }

  /**
   * Adds a platform-specific LIMIT clause to the query.
   */
  protected doModifyLimitQuery(query: string, limit: number | null, offset: number): string {
    if (limit !== null) {
      query += ` LIMIT ${limit}`;
    }

    if (offset > 0) {
      query += ` OFFSET ${offset}`;
    }

    return query;
  }

  /**
   * Quotes a literal string.
   * This method is NOT meant to fix SQL injections!
   * It is only meant to escape this platform's string literal
   * quote character inside the given literal string.
   */
  public quoteStringLiteral(str: string): string {
    return `'${str.replace(/'/g, `''`)}'`;
  }

  public getBooleanTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "BOOLEAN";
  }

  public getIntegerTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "INT";
  }

  public getBigIntTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "BIGINT";
  }

  public getSmallIntTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "SMALLINT";
  }

  public getAsciiStringTypeDeclarationSQL(column: Record<string, unknown>): string {
    return this.getStringTypeDeclarationSQL(column);
  }

  public getStringTypeDeclarationSQL(column: Record<string, unknown>): string {
    return this.getVarcharTypeDeclarationSQLSnippet(this.readLength(column));
  }

  public getBinaryTypeDeclarationSQL(column: Record<string, unknown>): string {
    const fixed = this.readBoolean(column, "fixed");
    const length = this.readLength(column);

    if (fixed) {
      return this.getBinaryTypeDeclarationSQLSnippet(length);
    }

    return this.getVarbinaryTypeDeclarationSQLSnippet(length);
  }

  public getGuidTypeDeclarationSQL(column: Record<string, unknown>): string {
    return this.getStringTypeDeclarationSQL({
      ...column,
      fixed: true,
      length: this.readLength(column) ?? 36,
    });
  }

  public getJsonTypeDeclarationSQL(column: Record<string, unknown>): string {
    return this.getClobTypeDeclarationSQL(column);
  }

  public getJsonbTypeDeclarationSQL(column: Record<string, unknown>): string {
    return this.getJsonTypeDeclarationSQL(column);
  }

  public getClobTypeDeclarationSQL(column: Record<string, unknown>): string {
    const length = this.readLength(column);
    if (length !== undefined && length <= 65535) {
      return `VARCHAR(${length})`;
    }

    return "TEXT";
  }

  public getBlobTypeDeclarationSQL(column: Record<string, unknown>): string {
    const length = this.readLength(column);
    if (length !== undefined && length <= 65535) {
      return `VARBINARY(${length})`;
    }

    return "BLOB";
  }

  public getDecimalTypeDeclarationSQL(column: Record<string, unknown>): string {
    const precision = this.readNumber(column, "precision") ?? 10;
    const scale = this.readNumber(column, "scale") ?? 0;

    return `NUMERIC(${precision}, ${scale})`;
  }

  public getFloatDeclarationSQL(_column: Record<string, unknown>): string {
    return "DOUBLE PRECISION";
  }

  public getSmallFloatDeclarationSQL(_column: Record<string, unknown>): string {
    return "REAL";
  }

  public getDateTimeTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "DATETIME";
  }

  public getDateTimeTzTypeDeclarationSQL(column: Record<string, unknown>): string {
    return this.getDateTimeTypeDeclarationSQL(column);
  }

  public getDateTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "DATE";
  }

  public getTimeTypeDeclarationSQL(_column: Record<string, unknown>): string {
    return "TIME";
  }

  public getEnumDeclarationSQL(column: Record<string, unknown>): string {
    const values = column.values;
    if (!Array.isArray(values) || values.length === 0) {
      return this.getStringTypeDeclarationSQL(column);
    }

    const quoted = values.map((value) => this.quoteStringLiteral(String(value)));
    return `ENUM(${quoted.join(", ")})`;
  }

  protected getCharTypeDeclarationSQLSnippet(length: number | undefined): string {
    return `CHAR(${length ?? 1})`;
  }

  protected getVarcharTypeDeclarationSQLSnippet(length: number | undefined): string {
    return `VARCHAR(${length ?? 255})`;
  }

  protected getBinaryTypeDeclarationSQLSnippet(length: number | undefined): string {
    return `BINARY(${length ?? 255})`;
  }

  protected getVarbinaryTypeDeclarationSQLSnippet(length: number | undefined): string {
    return `VARBINARY(${length ?? 255})`;
  }

  /**
   * Initializes platform-native DB type -> Datazen Type mapping.
   * Subclasses should override this to provide vendor-specific defaults.
   */
  protected initializeDatazenTypeMappings(): Record<string, string> {
    return {};
  }

  public registerDatazenTypeMapping(dbType: string, datazenType: string): void {
    this.ensureDatazenTypeMappingsInitialized();
    this.datazenTypeMapping![dbType.toLowerCase()] = datazenType;
  }

  public hasDatazenTypeMappingFor(dbType: string): boolean {
    this.ensureDatazenTypeMappingsInitialized();
    return Object.hasOwn(this.datazenTypeMapping!, dbType.toLowerCase());
  }

  public getDatazenTypeMapping(dbType: string): string {
    this.ensureDatazenTypeMappingsInitialized();
    const key = dbType.toLowerCase();
    const mapped = this.datazenTypeMapping![key];

    if (mapped === undefined) {
      throw new Error(
        `Unknown database type "${dbType}" requested, ${this.constructor.name} may not support it.`,
      );
    }

    return mapped;
  }

  public escapeStringForLike(inputString: string, escapeChar: string): string {
    const escapedEscape = escapeChar.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
    const escapedLikeChars = `${this.getLikeWildcardCharacters()}${escapeChar}`.replace(
      /[\\^$.*+?()[\]{}|]/g,
      "\\$&",
    );
    const pattern = new RegExp(`([${escapedLikeChars}])`, "g");

    return inputString.replace(pattern, `${escapedEscape}$1`);
  }

  public getRegexpExpression(): string {
    throw NotSupported.new("regexp");
  }

  public getLengthExpression(string: string): string {
    return `LENGTH(${string})`;
  }

  public getModExpression(dividend: string, divisor: string): string {
    return `MOD(${dividend}, ${divisor})`;
  }

  public getTrimExpression(
    str: string,
    mode: TrimMode = TrimMode.UNSPECIFIED,
    char: string | null = null,
  ): string {
    const tokens: string[] = [];

    if (mode === TrimMode.LEADING) {
      tokens.push("LEADING");
    } else if (mode === TrimMode.TRAILING) {
      tokens.push("TRAILING");
    } else if (mode === TrimMode.BOTH) {
      tokens.push("BOTH");
    }

    if (char !== null) {
      tokens.push(char);
    }

    if (tokens.length > 0) {
      tokens.push("FROM");
    }

    tokens.push(str);

    return `TRIM(${tokens.join(" ")})`;
  }

  public abstract getLocateExpression(
    string: string,
    substring: string,
    start?: string | null,
  ): string;

  public getSubstringExpression(
    string: string,
    start: string,
    length: string | null = null,
  ): string {
    if (length === null) {
      return `SUBSTRING(${string} FROM ${start})`;
    }

    return `SUBSTRING(${string} FROM ${start} FOR ${length})`;
  }

  public getConcatExpression(...string: string[]): string {
    return string.join(" || ");
  }

  public abstract getDateDiffExpression(date1: string, date2: string): string;

  public getDateAddSecondsExpression(date: string, seconds: string): string {
    return this.getDateArithmeticIntervalExpression(date, "+", seconds, DateIntervalUnit.SECOND);
  }

  public getDateSubSecondsExpression(date: string, seconds: string): string {
    return this.getDateArithmeticIntervalExpression(date, "-", seconds, DateIntervalUnit.SECOND);
  }

  public getDateAddMinutesExpression(date: string, minutes: string): string {
    return this.getDateArithmeticIntervalExpression(date, "+", minutes, DateIntervalUnit.MINUTE);
  }

  public getDateSubMinutesExpression(date: string, minutes: string): string {
    return this.getDateArithmeticIntervalExpression(date, "-", minutes, DateIntervalUnit.MINUTE);
  }

  public getDateAddHourExpression(date: string, hours: string): string {
    return this.getDateArithmeticIntervalExpression(date, "+", hours, DateIntervalUnit.HOUR);
  }

  public getDateSubHourExpression(date: string, hours: string): string {
    return this.getDateArithmeticIntervalExpression(date, "-", hours, DateIntervalUnit.HOUR);
  }

  public getDateAddDaysExpression(date: string, days: string): string {
    return this.getDateArithmeticIntervalExpression(date, "+", days, DateIntervalUnit.DAY);
  }

  public getDateSubDaysExpression(date: string, days: string): string {
    return this.getDateArithmeticIntervalExpression(date, "-", days, DateIntervalUnit.DAY);
  }

  public getDateAddWeeksExpression(date: string, weeks: string): string {
    return this.getDateArithmeticIntervalExpression(date, "+", weeks, DateIntervalUnit.WEEK);
  }

  public getDateSubWeeksExpression(date: string, weeks: string): string {
    return this.getDateArithmeticIntervalExpression(date, "-", weeks, DateIntervalUnit.WEEK);
  }

  public getDateAddMonthExpression(date: string, months: string): string {
    return this.getDateArithmeticIntervalExpression(date, "+", months, DateIntervalUnit.MONTH);
  }

  public getDateSubMonthExpression(date: string, months: string): string {
    return this.getDateArithmeticIntervalExpression(date, "-", months, DateIntervalUnit.MONTH);
  }

  public getDateAddQuarterExpression(date: string, quarters: string): string {
    return this.getDateArithmeticIntervalExpression(date, "+", quarters, DateIntervalUnit.QUARTER);
  }

  public getDateSubQuarterExpression(date: string, quarters: string): string {
    return this.getDateArithmeticIntervalExpression(date, "-", quarters, DateIntervalUnit.QUARTER);
  }

  public getDateAddYearExpression(date: string, years: string): string {
    return this.getDateArithmeticIntervalExpression(date, "+", years, DateIntervalUnit.YEAR);
  }

  public getDateSubYearExpression(date: string, years: string): string {
    return this.getDateArithmeticIntervalExpression(date, "-", years, DateIntervalUnit.YEAR);
  }

  protected getDateArithmeticIntervalExpression(
    date: string,
    operator: string,
    interval: string,
    unit: DateIntervalUnit,
  ): string {
    return `${date} ${operator} INTERVAL '${interval}' ${unit}`;
  }

  public getCurrentDateSQL(): string {
    return "CURRENT_DATE";
  }

  public getCurrentTimeSQL(): string {
    return "CURRENT_TIME";
  }

  public getCurrentTimestampSQL(): string {
    return "CURRENT_TIMESTAMP";
  }

  public getCurrentDatabaseExpression(): string {
    throw NotSupported.new("currentDatabase");
  }

  protected getTransactionIsolationLevelSQL(level: TransactionIsolationLevel): string {
    switch (level) {
      case TransactionIsolationLevel.READ_UNCOMMITTED:
        return "READ UNCOMMITTED";
      case TransactionIsolationLevel.READ_COMMITTED:
        return "READ COMMITTED";
      case TransactionIsolationLevel.REPEATABLE_READ:
        return "REPEATABLE READ";
      case TransactionIsolationLevel.SERIALIZABLE:
        return "SERIALIZABLE";
    }
  }

  public abstract getSetTransactionIsolationSQL(level: TransactionIsolationLevel): string;

  public getDefaultTransactionIsolationLevel(): TransactionIsolationLevel {
    return TransactionIsolationLevel.READ_COMMITTED;
  }

  public supportsSequences(): boolean {
    return false;
  }

  public supportsIdentityColumns(): boolean {
    return false;
  }

  public supportsSavepoints(): boolean {
    return true;
  }

  public supportsReleaseSavepoints(): boolean {
    return this.supportsSavepoints();
  }

  public supportsSchemas(): boolean {
    return false;
  }

  public supportsInlineColumnComments(): boolean {
    return false;
  }

  public supportsCommentOnStatement(): boolean {
    return false;
  }

  public supportsColumnCollation(): boolean {
    return false;
  }

  public createSavePoint(savepoint: string): string {
    return `SAVEPOINT ${savepoint}`;
  }

  public releaseSavePoint(savepoint: string): string {
    return `RELEASE SAVEPOINT ${savepoint}`;
  }

  public rollbackSavePoint(savepoint: string): string {
    return `ROLLBACK TO SAVEPOINT ${savepoint}`;
  }

  public getDummySelectSQL(expression = "1"): string {
    return `SELECT ${expression}`;
  }

  public getTruncateTableSQL(tableName: string, _cascade = false): string {
    return `TRUNCATE TABLE ${tableName}`;
  }

  public getDateTimeFormatString(): string {
    return "Y-m-d H:i:s";
  }

  public getDateTimeTzFormatString(): string {
    return "Y-m-d H:i:s";
  }

  public getDateFormatString(): string {
    return "Y-m-d";
  }

  public getTimeFormatString(): string {
    return "H:i:s";
  }

  public getMaxIdentifierLength(): number {
    return 63;
  }

  public getEmptyIdentityInsertSQL(
    quotedTableName: string,
    quotedIdentifierColumnName: string,
  ): string {
    return `INSERT INTO ${quotedTableName} (${quotedIdentifierColumnName}) VALUES (null)`;
  }

  public convertBooleans(item: unknown): unknown {
    if (Array.isArray(item)) {
      return item.map((value) => (typeof value === "boolean" ? Number(value) : value));
    }

    if (typeof item === "boolean") {
      return Number(item);
    }

    return item;
  }

  public convertFromBoolean(item: unknown): boolean | null {
    if (item === null) {
      return null;
    }

    return Boolean(item);
  }

  public convertBooleansToDatabaseValue(item: unknown): unknown {
    return this.convertBooleans(item);
  }

  public appendLockHint(fromClause: string, _lockMode: LockMode): string {
    return fromClause;
  }

  protected multiplyInterval(interval: string, factor: number): string {
    return `${interval} * ${factor}`;
  }

  protected getLikeWildcardCharacters(): string {
    return "%_";
  }

  public getUnionSelectPartSQL(subQuery: string): string {
    return `(${subQuery})`;
  }

  /**
   * Returns the `UNION ALL` keyword.
   */
  public getUnionAllSQL(): string {
    return "UNION ALL";
  }

  /**
   * Returns the compatible `UNION DISTINCT` keyword.
   */
  public getUnionDistinctSQL(): string {
    return "UNION";
  }

  public createSelectSQLBuilder(): SelectSQLBuilder {
    return new DefaultSelectSQLBuilder(this, "FOR UPDATE", "SKIP LOCKED");
  }

  public createUnionSQLBuilder(): UnionSQLBuilder {
    return new DefaultUnionSQLBuilder(this);
  }

  public createWithSQLBuilder(): WithSQLBuilder {
    return new WithSQLBuilder();
  }

  private readLength(column: Record<string, unknown>): number | undefined {
    return this.readNumber(column, "length");
  }

  private readNumber(column: Record<string, unknown>, key: string): number | undefined {
    const value = column[key];
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  }

  private readBoolean(column: Record<string, unknown>, key: string): boolean {
    return column[key] === true;
  }

  private ensureDatazenTypeMappingsInitialized(): void {
    if (this.datazenTypeMapping !== null) {
      return;
    }

    this.datazenTypeMapping = {};
    for (const [dbType, datazenType] of Object.entries(this.initializeDatazenTypeMappings())) {
      this.datazenTypeMapping[dbType.toLowerCase()] = datazenType;
    }
  }
}
