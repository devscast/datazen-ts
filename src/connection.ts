import { ArrayParameterType } from "./array-parameter-type";
import { Configuration } from "./configuration";
import type { Driver, DriverConnection } from "./driver";
import type { ExceptionConverter } from "./driver/api/exception-converter";
import {
  ConnectionException,
  DbalException,
  NestedTransactionsNotSupportedException,
  NoActiveTransactionException,
  RollbackOnlyException,
} from "./exception/index";
import { ParameterCompiler } from "./parameter-compiler";
import { ParameterType } from "./parameter-type";
import { AbstractPlatform } from "./platforms/abstract-platform";
import { MySQLPlatform } from "./platforms/mysql-platform";
import { SQLServerPlatform } from "./platforms/sql-server-platform";
import { Query } from "./query";
import { ExpressionBuilder } from "./query/expression/expression-builder";
import { QueryBuilder } from "./query/query-builder";
import { Result } from "./result";
import { Statement, type StatementExecutor } from "./statement";
import type {
  QueryParameterType,
  QueryParameterTypes,
  QueryParameters,
  QueryScalarParameterType,
} from "./types";
import { Type } from "./types/index";

export class Connection implements StatementExecutor {
  private readonly compiler = new ParameterCompiler();
  private driverConnection: DriverConnection | null = null;
  private transactionNestingLevel = 0;
  private rollbackOnly = false;
  private latestInsertId: number | string | null = null;
  private exceptionConverter: ExceptionConverter | null = null;
  private databasePlatform: AbstractPlatform | null = null;

  constructor(
    private readonly params: Record<string, unknown>,
    private readonly driver: Driver,
    private readonly configuration: Configuration = new Configuration(),
  ) {}

  public getParams(): Record<string, unknown> {
    return this.params;
  }

  public getDriver(): Driver {
    return this.driver;
  }

  public getConfiguration(): Configuration {
    return this.configuration;
  }

  public createExpressionBuilder(): ExpressionBuilder {
    return new ExpressionBuilder(this);
  }

  public createQueryBuilder(): QueryBuilder {
    return new QueryBuilder(this);
  }

  public isConnected(): boolean {
    return this.driverConnection !== null;
  }

  public isTransactionActive(): boolean {
    return this.transactionNestingLevel > 0;
  }

  public getTransactionNestingLevel(): number {
    return this.transactionNestingLevel;
  }

  public async getServerVersion(): Promise<string> {
    try {
      return (await this.connect()).getServerVersion();
    } catch (error) {
      throw this.convertException(error, "getServerVersion");
    }
  }

  public async prepare(sql: string): Promise<Statement> {
    try {
      await this.connect();
      return new Statement(this, sql);
    } catch (error) {
      throw this.convertException(error, "prepare", new Query(sql));
    }
  }

  public async executeQuery(
    sql: string,
    params: QueryParameters = [],
    types: QueryParameterTypes = [],
  ): Promise<Result> {
    const [boundParams, boundTypes] = this.normalizeParameters(params, types);
    const compiledQuery = this.compiler.compile(
      sql,
      boundParams,
      boundTypes,
      this.driver.bindingStyle,
    );
    const query = new Query(sql, params, types);

    try {
      const result = await (await this.connect()).executeQuery(compiledQuery);
      return new Result(result);
    } catch (error) {
      throw this.convertException(error, "executeQuery", query);
    }
  }

  public async executeQueryObject(query: Query): Promise<Result> {
    const [boundParams, boundTypes] = this.normalizeParameters(query.parameters, query.types);
    const compiledQuery = this.compiler.compile(
      query.sql,
      boundParams,
      boundTypes,
      this.driver.bindingStyle,
    );

    try {
      const result = await (await this.connect()).executeQuery(compiledQuery);
      return new Result(result);
    } catch (error) {
      throw this.convertException(error, "executeQuery", query);
    }
  }

  public async executeStatement(
    sql: string,
    params: QueryParameters = [],
    types: QueryParameterTypes = [],
  ): Promise<number> {
    const [boundParams, boundTypes] = this.normalizeParameters(params, types);
    const compiledQuery = this.compiler.compile(
      sql,
      boundParams,
      boundTypes,
      this.driver.bindingStyle,
    );
    const query = new Query(sql, params, types);

    try {
      const result = await (await this.connect()).executeStatement(compiledQuery);
      this.latestInsertId = result.insertId ?? null;
      return result.affectedRows;
    } catch (error) {
      throw this.convertException(error, "executeStatement", query);
    }
  }

  public async executeStatementObject(query: Query): Promise<number> {
    const [boundParams, boundTypes] = this.normalizeParameters(query.parameters, query.types);
    const compiledQuery = this.compiler.compile(
      query.sql,
      boundParams,
      boundTypes,
      this.driver.bindingStyle,
    );

    try {
      const result = await (await this.connect()).executeStatement(compiledQuery);
      this.latestInsertId = result.insertId ?? null;
      return result.affectedRows;
    } catch (error) {
      throw this.convertException(error, "executeStatement", query);
    }
  }

  public async fetchAssociative(
    sql: string,
    params: QueryParameters = [],
    types: QueryParameterTypes = [],
  ): Promise<Record<string, unknown> | false> {
    return (await this.executeQuery(sql, params, types)).fetchAssociative();
  }

  public async fetchNumeric(
    sql: string,
    params: QueryParameters = [],
    types: QueryParameterTypes = [],
  ): Promise<unknown[] | false> {
    return (await this.executeQuery(sql, params, types)).fetchNumeric();
  }

  public async fetchOne(
    sql: string,
    params: QueryParameters = [],
    types: QueryParameterTypes = [],
  ): Promise<unknown | false> {
    return (await this.executeQuery(sql, params, types)).fetchOne();
  }

  public async fetchAllAssociative(
    sql: string,
    params: QueryParameters = [],
    types: QueryParameterTypes = [],
  ): Promise<Array<Record<string, unknown>>> {
    return (await this.executeQuery(sql, params, types)).fetchAllAssociative();
  }

  public async fetchAllNumeric(
    sql: string,
    params: QueryParameters = [],
    types: QueryParameterTypes = [],
  ): Promise<unknown[][]> {
    return (await this.executeQuery(sql, params, types)).fetchAllNumeric();
  }

  public async fetchAllKeyValue(
    sql: string,
    params: QueryParameters = [],
    types: QueryParameterTypes = [],
  ): Promise<Record<string, unknown>> {
    return (await this.executeQuery(sql, params, types)).fetchAllKeyValue();
  }

  public async fetchAllAssociativeIndexed(
    sql: string,
    params: QueryParameters = [],
    types: QueryParameterTypes = [],
  ): Promise<Record<string, Record<string, unknown>>> {
    return (await this.executeQuery(sql, params, types)).fetchAllAssociativeIndexed();
  }

  public async fetchFirstColumn(
    sql: string,
    params: QueryParameters = [],
    types: QueryParameterTypes = [],
  ): Promise<unknown[]> {
    return (await this.executeQuery(sql, params, types)).fetchFirstColumn();
  }

  public async beginTransaction(): Promise<void> {
    try {
      const connection = await this.connect();

      if (this.transactionNestingLevel === 0) {
        await connection.beginTransaction();
        this.transactionNestingLevel = 1;
        return;
      }

      const savepointName = this.getNestedTransactionSavePointName(
        this.transactionNestingLevel + 1,
      );
      if (connection.createSavepoint === undefined) {
        throw new NestedTransactionsNotSupportedException(this.driver.name);
      }

      await connection.createSavepoint(savepointName);
      this.transactionNestingLevel += 1;
    } catch (error) {
      throw this.convertException(error, "beginTransaction");
    }
  }

  public async commit(): Promise<void> {
    if (this.transactionNestingLevel === 0) {
      throw new NoActiveTransactionException();
    }

    if (this.rollbackOnly) {
      throw new RollbackOnlyException();
    }

    try {
      const connection = await this.connect();
      if (this.transactionNestingLevel === 1) {
        await connection.commit();
        this.transactionNestingLevel = 0;
        this.rollbackOnly = false;
        return;
      }

      if (connection.releaseSavepoint === undefined) {
        throw new NestedTransactionsNotSupportedException(this.driver.name);
      }

      await connection.releaseSavepoint(
        this.getNestedTransactionSavePointName(this.transactionNestingLevel),
      );
      this.transactionNestingLevel -= 1;
    } catch (error) {
      throw this.convertException(error, "commit");
    }
  }

  public async rollBack(): Promise<void> {
    if (this.transactionNestingLevel === 0) {
      throw new NoActiveTransactionException();
    }

    try {
      const connection = await this.connect();
      if (this.transactionNestingLevel === 1) {
        await connection.rollBack();
        this.transactionNestingLevel = 0;
        this.rollbackOnly = false;
        return;
      }

      if (connection.rollbackSavepoint === undefined) {
        throw new NestedTransactionsNotSupportedException(this.driver.name);
      }

      await connection.rollbackSavepoint(
        this.getNestedTransactionSavePointName(this.transactionNestingLevel),
      );
      this.transactionNestingLevel -= 1;
    } catch (error) {
      throw this.convertException(error, "rollBack");
    }
  }

  public setRollbackOnly(): void {
    if (this.transactionNestingLevel === 0) {
      throw new NoActiveTransactionException();
    }

    this.rollbackOnly = true;
  }

  public isRollbackOnly(): boolean {
    if (this.transactionNestingLevel === 0) {
      throw new NoActiveTransactionException();
    }

    return this.rollbackOnly;
  }

  public async transactional<T>(fn: (connection: Connection) => Promise<T>): Promise<T> {
    await this.beginTransaction();

    try {
      const result = await fn(this);
      await this.commit();
      return result;
    } catch (error) {
      await this.rollBack();
      throw error;
    }
  }

  public async lastInsertId(): Promise<number | string | null> {
    return this.latestInsertId;
  }

  public async quote(value: string): Promise<string> {
    try {
      const connection = await this.connect();

      if (connection.quote !== undefined) {
        return connection.quote(value);
      }

      return `'${value.replace(/'/g, "''")}'`;
    } catch (error) {
      throw this.convertException(error, "quote");
    }
  }

  public async close(): Promise<void> {
    if (this.driverConnection === null) {
      return;
    }

    try {
      await this.driverConnection.close();
      this.driverConnection = null;
      this.transactionNestingLevel = 0;
      this.rollbackOnly = false;
    } catch (error) {
      throw this.convertException(error, "close");
    }
  }

  public async getNativeConnection(): Promise<unknown> {
    try {
      return (await this.connect()).getNativeConnection();
    } catch (error) {
      throw this.convertException(error, "getNativeConnection");
    }
  }

  private getNestedTransactionSavePointName(level: number): string {
    return `DATAZEN_${level}`;
  }

  public convertToDatabaseValue(value: unknown, type: string): unknown {
    return Type.getType(type).convertToDatabaseValue(value, this.getDatabasePlatform());
  }

  public convertToNodeValue(value: unknown, type: string): unknown {
    return Type.getType(type).convertToNodeValue(value, this.getDatabasePlatform());
  }

  public getDatabasePlatform(): AbstractPlatform {
    if (this.databasePlatform !== null) {
      return this.databasePlatform;
    }

    const customPlatform = this.params.platform;
    if (customPlatform instanceof AbstractPlatform) {
      this.databasePlatform = customPlatform;
      return this.databasePlatform;
    }

    const driverPlatform = this.driver.getDatabasePlatform?.();
    if (driverPlatform !== undefined) {
      this.databasePlatform = driverPlatform;
      return this.databasePlatform;
    }

    if (this.driver.name === "mysql2") {
      this.databasePlatform = new MySQLPlatform();
      return this.databasePlatform;
    }

    if (this.driver.name === "mssql") {
      this.databasePlatform = new SQLServerPlatform();
      return this.databasePlatform;
    }

    throw new DbalException(
      `No database platform could be resolved for driver "${this.driver.name}".`,
    );
  }

  private async connect(): Promise<DriverConnection> {
    if (this.driverConnection !== null) {
      return this.driverConnection;
    }

    try {
      this.driverConnection = await this.driver.connect(this.params);
      return this.driverConnection;
    } catch (error) {
      throw this.convertException(error, "connect");
    }
  }

  private convertException(error: unknown, operation: string, query?: Query): DbalException {
    if (error instanceof DbalException) {
      return error;
    }

    this.exceptionConverter ??= this.driver.getExceptionConverter();
    const converted = this.exceptionConverter.convert(error, { operation, query });

    if (converted instanceof ConnectionException) {
      this.driverConnection = null;
      this.transactionNestingLevel = 0;
      this.rollbackOnly = false;
    }

    return converted;
  }

  private normalizeParameters(
    params: QueryParameters,
    types: QueryParameterTypes,
  ): [QueryParameters, QueryParameterTypes] {
    if (Array.isArray(params) && Array.isArray(types)) {
      const normalizedParams = [...params];
      const normalizedTypes = [...types];

      for (const key in normalizedParams) {
        const index = Number(key);
        if (!Object.hasOwn(normalizedTypes, index)) {
          continue;
        }

        const type = normalizedTypes[index];
        if (type === undefined) {
          continue;
        }

        const [value, bindingType] = this.getBindingInfo(normalizedParams[index], type);
        normalizedParams[index] = value;
        normalizedTypes[index] = bindingType;
      }

      return [normalizedParams, normalizedTypes];
    }

    if (!Array.isArray(params) && !Array.isArray(types)) {
      const normalizedParams: Record<string, unknown> = { ...params };
      const normalizedTypes: Record<string, QueryParameterType> = { ...types };

      for (const [name, value] of Object.entries(normalizedParams)) {
        const type = this.readNamedType(name, normalizedTypes);
        if (type === undefined) {
          continue;
        }

        const [convertedValue, bindingType] = this.getBindingInfo(value, type);
        normalizedParams[name] = convertedValue;
        normalizedTypes[name] = bindingType;
      }

      return [normalizedParams, normalizedTypes];
    }

    return [params, types];
  }

  private getBindingInfo(
    value: unknown,
    type: QueryParameterType,
  ): [unknown, QueryScalarParameterType | ArrayParameterType] {
    if (this.isArrayParameterType(type) || this.isParameterType(type)) {
      return [value, type];
    }

    const datazenType = typeof type === "string" ? Type.getType(type) : type;
    const converted = datazenType.convertToDatabaseValue(value, this.getDatabasePlatform());

    return [converted, datazenType.getBindingType()];
  }

  private isArrayParameterType(type: QueryParameterType): type is ArrayParameterType {
    return (
      type === ArrayParameterType.INTEGER ||
      type === ArrayParameterType.STRING ||
      type === ArrayParameterType.ASCII ||
      type === ArrayParameterType.BINARY
    );
  }

  private isParameterType(value: unknown): value is ParameterType {
    return (
      value === ParameterType.NULL ||
      value === ParameterType.INTEGER ||
      value === ParameterType.STRING ||
      value === ParameterType.LARGE_OBJECT ||
      value === ParameterType.BOOLEAN ||
      value === ParameterType.BINARY ||
      value === ParameterType.ASCII
    );
  }

  private readNamedType(
    name: string,
    types: Record<string, QueryParameterType>,
  ): QueryParameterType | undefined {
    if (Object.hasOwn(types, name)) {
      return types[name];
    }

    if (name.startsWith(":")) {
      const plain = name.slice(1);
      if (Object.hasOwn(types, plain)) {
        return types[plain];
      }
    } else {
      const prefixed = `:${name}`;
      if (Object.hasOwn(types, prefixed)) {
        return types[prefixed];
      }
    }

    return undefined;
  }
}
