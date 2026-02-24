import { ConnectionException } from "../../../exception/connection-exception";
import { DeadlockException } from "../../../exception/deadlock-exception";
import { DriverException, type DriverExceptionDetails } from "../../../exception/driver-exception";
import { ForeignKeyConstraintViolationException } from "../../../exception/foreign-key-constraint-violation-exception";
import { NotNullConstraintViolationException } from "../../../exception/not-null-constraint-violation-exception";
import { SyntaxErrorException } from "../../../exception/syntax-error-exception";
import { UniqueConstraintViolationException } from "../../../exception/unique-constraint-violation-exception";
import type {
  ExceptionConverterContext,
  ExceptionConverter as ExceptionConverterInterface,
} from "../exception-converter";

const UNIQUE_CONSTRAINT_SQLSTATES = new Set(["23505"]);
const FOREIGN_KEY_CONSTRAINT_SQLSTATES = new Set(["23503"]);
const NOT_NULL_CONSTRAINT_SQLSTATES = new Set(["23502"]);
const SYNTAX_SQLSTATES = new Set(["42601", "42703", "42P01"]);
const CONNECTION_SQLSTATES = new Set(["57P01", "57P02", "57P03"]);

export class ExceptionConverter implements ExceptionConverterInterface {
  public convert(error: unknown, context: ExceptionConverterContext): DriverException {
    const details = this.createDetails(error, context);

    if (details.sqlState === "40P01") {
      return new DeadlockException(details.message, details);
    }

    if (details.sqlState !== undefined && UNIQUE_CONSTRAINT_SQLSTATES.has(details.sqlState)) {
      return new UniqueConstraintViolationException(details.message, details);
    }

    if (details.sqlState !== undefined && FOREIGN_KEY_CONSTRAINT_SQLSTATES.has(details.sqlState)) {
      return new ForeignKeyConstraintViolationException(details.message, details);
    }

    if (details.sqlState !== undefined && NOT_NULL_CONSTRAINT_SQLSTATES.has(details.sqlState)) {
      return new NotNullConstraintViolationException(details.message, details);
    }

    if (details.sqlState !== undefined && SYNTAX_SQLSTATES.has(details.sqlState)) {
      return new SyntaxErrorException(details.message, details);
    }

    if (this.isConnectionError(details)) {
      return new ConnectionException(details.message, details);
    }

    return new DriverException(details.message, details);
  }

  private createDetails(
    error: unknown,
    context: ExceptionConverterContext,
  ): DriverExceptionDetails & { message: string } {
    const record = this.asRecord(error);
    const code = this.extractCode(record);
    const sqlState = this.extractSqlState(record);
    const message = this.extractMessage(error);

    return {
      cause: error,
      code,
      driverName: "pg",
      message,
      operation: context.operation,
      parameters: context.query?.parameters,
      sql: context.query?.sql,
      sqlState,
    };
  }

  private extractCode(record: Record<string, unknown>): number | string | undefined {
    const code = record.code;
    if (typeof code === "string" || typeof code === "number") {
      return code;
    }

    return undefined;
  }

  private extractSqlState(record: Record<string, unknown>): string | undefined {
    const state = record.code;
    if (typeof state === "string") {
      return state;
    }

    const sqlState = record.sqlState;
    if (typeof sqlState === "string") {
      return sqlState;
    }

    return undefined;
  }

  private extractMessage(error: unknown): string {
    if (error instanceof Error && error.message.length > 0) {
      return error.message;
    }

    return "pg driver error.";
  }

  private isConnectionError(details: { code?: number | string; sqlState?: string }): boolean {
    if (details.sqlState !== undefined) {
      if (details.sqlState.startsWith("08") || CONNECTION_SQLSTATES.has(details.sqlState)) {
        return true;
      }
    }

    if (typeof details.code === "string") {
      return details.code.startsWith("ECONN") || details.code === "ETIMEDOUT";
    }

    return false;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (value !== null && typeof value === "object") {
      return value as Record<string, unknown>;
    }

    return {};
  }
}
