import {
  ConnectionError,
  DeadlockError,
  DriverError,
  type DriverErrorDetails,
  ForeignKeyConstraintViolationError,
  NotNullConstraintViolationError,
  SqlSyntaxError,
  UniqueConstraintViolationError,
} from "../../../exception/index";
import type {
  ExceptionConverterContext,
  ExceptionConverter as ExceptionConverterContract,
} from "../exception-converter";

const FOREIGN_KEY_CONSTRAINT_CODES = new Set([547, 4712]);
const UNIQUE_CONSTRAINT_CODES = new Set([2601, 2627]);
const CONNECTION_ERROR_CODES = new Set([11001, 18456]);
const CONNECTION_ERROR_STRINGS = new Set([
  "EALREADYBEGUN",
  "EALREADYCONNECTED",
  "ECANCEL",
  "ECONNCLOSED",
  "ECONNRESET",
  "EINSTLOOKUP",
  "ELOGIN",
  "ESOCKET",
  "ETIMEOUT",
]);
const SQL_SYNTAX_CODES = new Set([102, 156, 207, 208, 209]);

export class ExceptionConverter implements ExceptionConverterContract {
  public convert(error: unknown, context: ExceptionConverterContext): DriverError {
    const details = this.createDetails(error, context);

    if (details.code === 1205) {
      return new DeadlockError(details.message, details);
    }

    if (details.code === 515) {
      return new NotNullConstraintViolationError(details.message, details);
    }

    if (typeof details.code === "number" && FOREIGN_KEY_CONSTRAINT_CODES.has(details.code)) {
      return new ForeignKeyConstraintViolationError(details.message, details);
    }

    if (typeof details.code === "number" && UNIQUE_CONSTRAINT_CODES.has(details.code)) {
      return new UniqueConstraintViolationError(details.message, details);
    }

    if (typeof details.code === "number" && SQL_SYNTAX_CODES.has(details.code)) {
      return new SqlSyntaxError(details.message, details);
    }

    if (this.isConnectionError(details.code)) {
      return new ConnectionError(details.message, details);
    }

    return new DriverError(details.message, details);
  }

  private createDetails(
    error: unknown,
    context: ExceptionConverterContext,
  ): DriverErrorDetails & { message: string } {
    const errorRecord = this.asRecord(error);
    const code = this.extractCode(errorRecord);
    const message = this.extractMessage(error);

    return {
      cause: error,
      code,
      driverName: "mssql",
      message,
      operation: context.operation,
      parameters: context.query?.parameters,
      sql: context.query?.sql,
      sqlState: this.extractSqlState(errorRecord),
    };
  }

  private extractCode(errorRecord: Record<string, unknown>): number | string | undefined {
    const candidates: unknown[] = [
      errorRecord.number,
      this.getNestedValue(errorRecord, "originalError", "info", "number"),
      this.getNestedValue(errorRecord, "originalError", "number"),
      errorRecord.code,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "number" || typeof candidate === "string") {
        return candidate;
      }
    }

    return undefined;
  }

  private extractSqlState(errorRecord: Record<string, unknown>): string | undefined {
    const candidates: unknown[] = [
      errorRecord.sqlState,
      errorRecord.sqlstate,
      errorRecord.state,
      this.getNestedValue(errorRecord, "originalError", "info", "state"),
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "string") {
        return candidate;
      }
    }

    return undefined;
  }

  private extractMessage(error: unknown): string {
    if (error instanceof Error && error.message.length > 0) {
      return error.message;
    }

    return "mssql driver error.";
  }

  private isConnectionError(code: number | string | undefined): boolean {
    if (typeof code === "number") {
      return CONNECTION_ERROR_CODES.has(code);
    }

    if (typeof code === "string") {
      return CONNECTION_ERROR_STRINGS.has(code);
    }

    return false;
  }

  private getNestedValue(record: Record<string, unknown>, ...keys: string[]): unknown {
    let current: unknown = record;
    for (const key of keys) {
      if (current === null || typeof current !== "object") {
        return undefined;
      }

      current = (current as Record<string, unknown>)[key];
    }

    return current;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (value !== null && typeof value === "object") {
      return value as Record<string, unknown>;
    }

    return {};
  }
}
