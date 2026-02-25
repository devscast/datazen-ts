import type { Connection } from "../connection";
import { SQLiteSchemaManager } from "../schema/sqlite-schema-manager";
import { TransactionIsolationLevel } from "../transaction-isolation-level";
import { Types } from "../types/types";
import { AbstractPlatform } from "./abstract-platform";
import { NotSupported } from "./exception/not-supported";
import type { KeywordList } from "./keywords/keyword-list";
import { SQLiteKeywords } from "./keywords/sqlite-keywords";
import { SQLiteMetadataProvider } from "./sqlite/sqlite-metadata-provider";

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
    if (start === null) {
      return `INSTR(${string}, ${substring})`;
    }

    return `(INSTR(SUBSTR(${string}, ${start}), ${substring}) + ${start} - 1)`;
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

  public getSetTransactionIsolationSQL(_level: TransactionIsolationLevel): string {
    throw NotSupported.new("setTransactionIsolation");
  }

  public supportsIdentityColumns(): boolean {
    return true;
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
}
