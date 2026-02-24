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

export class ExceptionConverter implements ExceptionConverterInterface {
  public convert(error: unknown, context: ExceptionConverterContext): DriverException {
    const details = this.createDetails(error, context);
    const code = typeof details.code === "string" ? details.code.toUpperCase() : undefined;
    const message = details.message.toLowerCase();

    if (code === "SQLITE_BUSY" || code === "SQLITE_LOCKED") {
      return new DeadlockException(details.message, details);
    }

    if (code === "SQLITE_CANTOPEN") {
      return new ConnectionException(details.message, details);
    }

    if (code?.startsWith("SQLITE_CONSTRAINT_FOREIGNKEY") === true) {
      return new ForeignKeyConstraintViolationException(details.message, details);
    }

    if (code?.startsWith("SQLITE_CONSTRAINT_NOTNULL") === true) {
      return new NotNullConstraintViolationException(details.message, details);
    }

    if (
      code?.startsWith("SQLITE_CONSTRAINT_UNIQUE") === true ||
      code?.startsWith("SQLITE_CONSTRAINT_PRIMARYKEY") === true
    ) {
      return new UniqueConstraintViolationException(details.message, details);
    }

    if (code === "SQLITE_ERROR" && message.includes("syntax")) {
      return new SyntaxErrorException(details.message, details);
    }

    return new DriverException(details.message, details);
  }

  private createDetails(
    error: unknown,
    context: ExceptionConverterContext,
  ): DriverExceptionDetails & { message: string } {
    const record = this.asRecord(error);
    const message = this.extractMessage(error);

    return {
      cause: error,
      code: this.extractCode(record),
      driverName: "sqlite3",
      message,
      operation: context.operation,
      parameters: context.query?.parameters,
      sql: context.query?.sql,
      sqlState: undefined,
    };
  }

  private extractCode(record: Record<string, unknown>): number | string | undefined {
    const code = record.code;
    if (typeof code === "string" || typeof code === "number") {
      return code;
    }

    const errno = record.errno;
    if (typeof errno === "number") {
      return errno;
    }

    return undefined;
  }

  private extractMessage(error: unknown): string {
    if (error instanceof Error && error.message.length > 0) {
      return error.message;
    }

    return "sqlite3 driver error.";
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (value !== null && typeof value === "object") {
      return value as Record<string, unknown>;
    }

    return {};
  }
}
