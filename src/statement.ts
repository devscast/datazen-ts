import { MixedParameterStyleException } from "./exception/index";
import { ParameterType } from "./parameter-type";
import type { Result } from "./result";
import type { QueryParameterType, QueryParameterTypes, QueryParameters } from "./types";

export interface StatementExecutor {
  executeQuery(sql: string, params?: QueryParameters, types?: QueryParameterTypes): Promise<Result>;
  executeStatement(
    sql: string,
    params?: QueryParameters,
    types?: QueryParameterTypes,
  ): Promise<number>;
}

export class Statement {
  private readonly namedParams: Record<string, unknown> = {};
  private readonly namedTypes: Record<string, QueryParameterType> = {};
  private readonly positionalParams: unknown[] = [];
  private readonly positionalTypes: QueryParameterType[] = [];

  constructor(
    private readonly executor: StatementExecutor,
    private readonly sql: string,
  ) {}

  public bindValue(
    param: string | number,
    value: unknown,
    type: QueryParameterType = ParameterType.STRING,
  ): this {
    if (typeof param === "number") {
      const index = Math.max(0, param - 1);
      this.positionalParams[index] = value;
      this.positionalTypes[index] = type;
      return this;
    }

    const normalizedName = param.startsWith(":") ? param.slice(1) : param;
    this.namedParams[normalizedName] = value;
    this.namedTypes[normalizedName] = type;
    return this;
  }

  public setParameters(params: QueryParameters, types: QueryParameterTypes = []): this {
    if (Array.isArray(params)) {
      this.positionalParams.length = 0;
      this.positionalParams.push(...params);

      this.positionalTypes.length = 0;
      if (Array.isArray(types)) {
        this.positionalTypes.push(...types);
      }
    } else {
      Object.assign(this.namedParams, params);
      if (!Array.isArray(types)) {
        Object.assign(this.namedTypes, types);
      }
    }

    return this;
  }

  public async executeQuery(): Promise<Result> {
    const [params, types] = this.getBoundParameters();
    return this.executor.executeQuery(this.sql, params, types);
  }

  public async executeStatement(): Promise<number> {
    const [params, types] = this.getBoundParameters();
    return this.executor.executeStatement(this.sql, params, types);
  }

  public getSQL(): string {
    return this.sql;
  }

  private getBoundParameters(): [QueryParameters, QueryParameterTypes] {
    const hasNamed = Object.keys(this.namedParams).length > 0;
    const hasPositional = this.positionalParams.length > 0;

    if (hasNamed && hasPositional) {
      throw new MixedParameterStyleException();
    }

    if (hasNamed) {
      return [this.namedParams, this.namedTypes];
    }

    return [this.positionalParams, this.positionalTypes];
  }
}
