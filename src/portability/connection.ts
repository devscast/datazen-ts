import type { DriverConnection, DriverExecutionResult, DriverQueryResult } from "../driver";
import type { CompiledQuery } from "../types";
import { Converter } from "./converter";
import { Result } from "./result";

export class Connection implements DriverConnection {
  public static readonly PORTABILITY_ALL = 255;
  public static readonly PORTABILITY_NONE = 0;
  public static readonly PORTABILITY_RTRIM = 1;
  public static readonly PORTABILITY_EMPTY_TO_NULL = 4;
  public static readonly PORTABILITY_FIX_CASE = 8;

  public readonly createSavepoint?: (name: string) => Promise<void>;
  public readonly releaseSavepoint?: (name: string) => Promise<void>;
  public readonly rollbackSavepoint?: (name: string) => Promise<void>;
  public readonly quote?: (value: string) => string;

  constructor(
    private readonly connection: DriverConnection,
    private readonly converter: Converter,
  ) {
    if (this.connection.createSavepoint !== undefined) {
      this.createSavepoint = async (name: string): Promise<void> =>
        this.connection.createSavepoint?.(name);
    }

    if (this.connection.releaseSavepoint !== undefined) {
      this.releaseSavepoint = async (name: string): Promise<void> =>
        this.connection.releaseSavepoint?.(name);
    }

    if (this.connection.rollbackSavepoint !== undefined) {
      this.rollbackSavepoint = async (name: string): Promise<void> =>
        this.connection.rollbackSavepoint?.(name);
    }

    if (this.connection.quote !== undefined) {
      this.quote = (value: string): string => this.connection.quote!(value);
    }
  }

  public async executeQuery(query: CompiledQuery): Promise<DriverQueryResult> {
    const result = await this.connection.executeQuery(query);
    return new Result(result, this.converter).toDriverQueryResult();
  }

  public async executeStatement(query: CompiledQuery): Promise<DriverExecutionResult> {
    return this.connection.executeStatement(query);
  }

  public async beginTransaction(): Promise<void> {
    await this.connection.beginTransaction();
  }

  public async commit(): Promise<void> {
    await this.connection.commit();
  }

  public async rollBack(): Promise<void> {
    await this.connection.rollBack();
  }

  public async getServerVersion(): Promise<string> {
    return this.connection.getServerVersion();
  }

  public async close(): Promise<void> {
    await this.connection.close();
  }

  public getNativeConnection(): unknown {
    return this.connection.getNativeConnection();
  }
}
