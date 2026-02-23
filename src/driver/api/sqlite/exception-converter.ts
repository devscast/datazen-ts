import {
  ConnectionException,
  DeadlockException,
  DriverException,
  type DriverExceptionDetails,
  ForeignKeyConstraintViolationException,
  NotNullConstraintViolationException,
  SqlSyntaxException,
  UniqueConstraintViolationException,
} from "../../../exception/index";
import type {
  ExceptionConverterContext,
  ExceptionConverter as ExceptionConverterContract,
} from "../exception-converter";

export class ExceptionConverter implements ExceptionConverterContract {
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
      return new SqlSyntaxException(details.message, details);
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
