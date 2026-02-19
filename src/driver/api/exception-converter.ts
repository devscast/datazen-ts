import type { DriverError } from "../../exception/driver-error";
import type { Query } from "../../query";

export interface ExceptionConverterContext {
  operation: string;
  query?: Query;
}

export interface ExceptionConverter {
  convert(error: unknown, context: ExceptionConverterContext): DriverError;
}
