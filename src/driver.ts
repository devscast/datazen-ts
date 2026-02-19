import type { ExceptionConverter } from "./driver/api/exception-converter";
import type { AbstractPlatform } from "./platforms/abstract-platform";
import type { ServerVersionProvider } from "./server-version-provider";
import type { CompiledQuery } from "./types";

export enum ParameterBindingStyle {
  POSITIONAL = "positional",
  NAMED = "named",
}

export interface DriverQueryResult {
  rows: Array<Record<string, unknown>>;
  columns?: string[];
  rowCount?: number;
}

export interface DriverExecutionResult {
  affectedRows: number;
  insertId?: number | string | null;
}

export interface DriverConnection extends ServerVersionProvider {
  executeQuery(query: CompiledQuery): Promise<DriverQueryResult>;
  executeStatement(query: CompiledQuery): Promise<DriverExecutionResult>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollBack(): Promise<void>;
  createSavepoint?(name: string): Promise<void>;
  releaseSavepoint?(name: string): Promise<void>;
  rollbackSavepoint?(name: string): Promise<void>;
  quote?(value: string): string;
  close(): Promise<void>;
  getNativeConnection(): unknown;
}

export interface Driver {
  readonly name: string;
  readonly bindingStyle: ParameterBindingStyle;
  connect(params: Record<string, unknown>): Promise<DriverConnection>;
  getExceptionConverter(): ExceptionConverter;
  getDatabasePlatform?(): AbstractPlatform;
}

export interface DriverMiddleware {
  wrap(driver: Driver): Driver;
}
