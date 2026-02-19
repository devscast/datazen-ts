import { DbalException } from "./dbal-exception";

export interface DriverExceptionDetails {
  driverName: string;
  operation: string;
  sql?: string;
  parameters?: unknown;
  code?: number | string;
  sqlState?: string;
  cause?: unknown;
}

export class DriverException extends DbalException {
  public readonly driverName: string;
  public readonly operation: string;
  public readonly sql?: string;
  public readonly parameters?: unknown;
  public readonly code?: number | string;
  public readonly sqlState?: string;

  constructor(message: string, details: DriverExceptionDetails) {
    super(message);
    this.driverName = details.driverName;
    this.operation = details.operation;
    this.sql = details.sql;
    this.parameters = details.parameters;
    this.code = details.code;
    this.sqlState = details.sqlState;

    if (details.cause !== undefined) {
      Object.defineProperty(this, "cause", {
        configurable: true,
        enumerable: false,
        value: details.cause,
        writable: true,
      });
    }
  }
}
