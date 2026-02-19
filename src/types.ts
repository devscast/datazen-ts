import { ArrayParameterType } from "./array-parameter-type";
import { ParameterType } from "./parameter-type";
import type { Type } from "./types/type";

export type QueryScalarParameterType = ParameterType | string | Type;
export type QueryParameterType = QueryScalarParameterType | ArrayParameterType;
export type QueryParameters = unknown[] | Record<string, unknown>;
export type QueryParameterTypes = QueryParameterType[] | Record<string, QueryParameterType>;

export interface CompiledQuery {
  sql: string;
  parameters: QueryParameters;
  types: QueryScalarParameterType[] | Record<string, QueryScalarParameterType>;
}
