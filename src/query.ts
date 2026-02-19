import type { QueryParameterTypes, QueryParameters } from "./types";

export class Query {
  constructor(
    public readonly sql: string,
    public readonly parameters: QueryParameters = [],
    public readonly types: QueryParameterTypes = [],
  ) {}
}
