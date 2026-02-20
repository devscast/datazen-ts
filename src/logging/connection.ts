import type { DriverConnection, DriverExecutionResult, DriverQueryResult } from "../driver";
import type { CompiledQuery } from "../types";
import type { Logger } from "./logger";

export class Connection implements DriverConnection {
  public readonly createSavepoint?: (name: string) => Promise<void>;
  public readonly releaseSavepoint?: (name: string) => Promise<void>;
  public readonly rollbackSavepoint?: (name: string) => Promise<void>;
  public readonly quote?: (value: string) => string;

  constructor(
    private readonly connection: DriverConnection,
    private readonly logger: Logger,
  ) {
    if (this.connection.createSavepoint !== undefined) {
      this.createSavepoint = async (name: string): Promise<void> => {
        this.logger.debug("Creating savepoint {name}", { name });
        await this.connection.createSavepoint?.(name);
      };
    }

    if (this.connection.releaseSavepoint !== undefined) {
      this.releaseSavepoint = async (name: string): Promise<void> => {
        this.logger.debug("Releasing savepoint {name}", { name });
        await this.connection.releaseSavepoint?.(name);
      };
    }

    if (this.connection.rollbackSavepoint !== undefined) {
      this.rollbackSavepoint = async (name: string): Promise<void> => {
        this.logger.debug("Rolling back savepoint {name}", { name });
        await this.connection.rollbackSavepoint?.(name);
      };
    }

    if (this.connection.quote !== undefined) {
      this.quote = (value: string): string => this.connection.quote!(value);
    }
  }

  public async executeQuery(query: CompiledQuery): Promise<DriverQueryResult> {
    this.logger.debug("Executing query: {sql} (parameters: {params}, types: {types})", {
      params: query.parameters,
      sql: query.sql,
      types: query.types,
    });

    return this.connection.executeQuery(query);
  }

  public async executeStatement(query: CompiledQuery): Promise<DriverExecutionResult> {
    this.logger.debug("Executing statement: {sql} (parameters: {params}, types: {types})", {
      params: query.parameters,
      sql: query.sql,
      types: query.types,
    });

    return this.connection.executeStatement(query);
  }

  public async beginTransaction(): Promise<void> {
    this.logger.debug("Beginning transaction");
    await this.connection.beginTransaction();
  }

  public async commit(): Promise<void> {
    this.logger.debug("Committing transaction");
    await this.connection.commit();
  }

  public async rollBack(): Promise<void> {
    this.logger.debug("Rolling back transaction");
    await this.connection.rollBack();
  }

  public async getServerVersion(): Promise<string> {
    return this.connection.getServerVersion();
  }

  public async close(): Promise<void> {
    this.logger.info("Disconnecting");
    await this.connection.close();
  }

  public getNativeConnection(): unknown {
    return this.connection.getNativeConnection();
  }
}
