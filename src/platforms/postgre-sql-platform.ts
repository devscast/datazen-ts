import type { Connection } from "../connection";
import { PostgreSQLSchemaManager } from "../schema/postgre-sql-schema-manager";
import { TransactionIsolationLevel } from "../transaction-isolation-level";
import { Types } from "../types/types";
import { AbstractPlatform } from "./abstract-platform";
import type { KeywordList } from "./keywords/keyword-list";
import { PostgreSQLKeywords } from "./keywords/postgresql-keywords";
import { PostgreSQLMetadataProvider } from "./postgresql/postgre-sql-metadata-provider";

export class PostgreSQLPlatform extends AbstractPlatform {
  protected useBooleanTrueFalseStrings = false;

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
    if (start === null) {
      return `POSITION(${substring} IN ${string})`;
    }

    return `(POSITION(${substring} IN SUBSTRING(${string} FROM ${start})) + ${start} - 1)`;
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
