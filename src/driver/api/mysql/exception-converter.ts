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

const FOREIGN_KEY_CONSTRAINT_CODES = new Set([1216, 1217, 1451, 1452, 1701]);
const UNIQUE_CONSTRAINT_CODES = new Set([1062, 1557, 1569, 1586]);
const NOT_NULL_CONSTRAINT_CODES = new Set([1048, 1121, 1138, 1171, 1252, 1263, 1364, 1566]);
const SQL_SYNTAX_CODES = new Set([
  1064, 1149, 1287, 1341, 1342, 1343, 1344, 1382, 1479, 1541, 1554, 1626,
]);
const CONNECTION_ERROR_CODES = new Set([
  1044, 1045, 1046, 1049, 1095, 1142, 1143, 1227, 1370, 1429, 2002, 2005, 2054,
]);
const CONNECTION_ERROR_STRINGS = new Set([
  "ECONNREFUSED",
  "ER_ACCESS_DENIED_ERROR",
  "ER_BAD_DB_ERROR",
  "PROTOCOL_CONNECTION_LOST",
  "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR",
  "PROTOCOL_ENQUEUE_AFTER_QUIT",
  "ETIMEDOUT",
]);

export class ExceptionConverter implements ExceptionConverterContract {
  public convert(error: unknown, context: ExceptionConverterContext): DriverError {
    const details = this.createDetails(error, context);

    if (details.code === 1213) {
      return new DeadlockError(details.message, details);
    }

    if (typeof details.code === "number" && FOREIGN_KEY_CONSTRAINT_CODES.has(details.code)) {
      return new ForeignKeyConstraintViolationError(details.message, details);
    }

    if (typeof details.code === "number" && UNIQUE_CONSTRAINT_CODES.has(details.code)) {
      return new UniqueConstraintViolationError(details.message, details);
    }

    if (typeof details.code === "number" && NOT_NULL_CONSTRAINT_CODES.has(details.code)) {
      return new NotNullConstraintViolationError(details.message, details);
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
      driverName: "mysql2",
      message,
      operation: context.operation,
      parameters: context.query?.parameters,
      sql: context.query?.sql,
      sqlState: this.extractSqlState(errorRecord),
    };
  }

  private extractCode(errorRecord: Record<string, unknown>): number | string | undefined {
    const errno = errorRecord.errno;
    if (typeof errno === "number") {
      return errno;
    }

    const code = errorRecord.code;
    if (typeof code === "number" || typeof code === "string") {
      return code;
    }

    return undefined;
  }

  private extractSqlState(errorRecord: Record<string, unknown>): string | undefined {
    const sqlState = errorRecord.sqlState;
    if (typeof sqlState === "string") {
      return sqlState;
    }

    return undefined;
  }

  private extractMessage(error: unknown): string {
    if (error instanceof Error && error.message.length > 0) {
      return error.message;
    }

    return "mysql2 driver error.";
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

  private asRecord(value: unknown): Record<string, unknown> {
    if (value !== null && typeof value === "object") {
      return value as Record<string, unknown>;
    }

    return {};
  }
}
