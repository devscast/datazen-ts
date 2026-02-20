import { ArrayParameterType } from "./array-parameter-type";
import {
  InvalidParameterException,
  MissingNamedParameterException,
  MissingPositionalParameterException,
  MixedParameterStyleException,
} from "./exception/index";
import { ParameterType } from "./parameter-type";
import type { Visitor } from "./sql/parser";
import type {
  QueryParameterType,
  QueryParameterTypes,
  QueryParameters,
  QueryScalarParameterType,
} from "./types";

type ParameterStyle = "none" | "named" | "positional";

export class ExpandArrayParameters implements Visitor {
  private originalParameterIndex = 0;
  private parameterStyle: ParameterStyle = "none";
  private readonly convertedSQL: string[] = [];
  private readonly convertedParameters: unknown[] = [];
  private readonly convertedTypes: QueryScalarParameterType[] = [];

  constructor(
    private readonly parameters: QueryParameters,
    private readonly types: QueryParameterTypes,
  ) {}

  public acceptPositionalParameter(_sql: string): void {
    this.acceptParameterStyle("positional");

    if (!Array.isArray(this.parameters)) {
      throw new MixedParameterStyleException();
    }

    const index = this.originalParameterIndex;
    if (!Object.hasOwn(this.parameters, index)) {
      throw new MissingPositionalParameterException(index);
    }

    this.acceptParameter(index, this.parameters[index]);
    this.originalParameterIndex += 1;
  }

  public acceptNamedParameter(sql: string): void {
    this.acceptParameterStyle("named");

    if (Array.isArray(this.parameters)) {
      throw new MixedParameterStyleException();
    }

    const name = sql.slice(1);
    const value = this.readNamedValue(name);
    this.acceptParameter(name, value);
  }

  public acceptOther(sql: string): void {
    this.convertedSQL.push(sql);
  }

  public getSQL(): string {
    return this.convertedSQL.join("");
  }

  public getParameters(): unknown[] {
    return this.convertedParameters;
  }

  public getTypes(): QueryScalarParameterType[] {
    return this.convertedTypes;
  }

  private acceptParameter(key: number | string, value: unknown): void {
    const type = this.readType(key) ?? ParameterType.STRING;

    if (!Array.isArray(value)) {
      this.appendTypedParameter([value], type);
      return;
    }

    if (!this.isArrayParameterType(type)) {
      throw new InvalidParameterException("Array values require an ArrayParameterType binding.");
    }

    if (value.length === 0) {
      this.convertedSQL.push("NULL");
      return;
    }

    this.appendTypedParameter(value, ArrayParameterType.toElementParameterType(type));
  }

  private readNamedValue(name: string): unknown {
    if (Array.isArray(this.parameters)) {
      throw new MixedParameterStyleException();
    }

    if (Object.hasOwn(this.parameters, name)) {
      return this.parameters[name];
    }

    const prefixedName = `:${name}`;
    if (Object.hasOwn(this.parameters, prefixedName)) {
      return this.parameters[prefixedName];
    }

    throw new MissingNamedParameterException(name);
  }

  private readType(key: number | string): QueryParameterType | undefined {
    if (Array.isArray(this.types)) {
      if (typeof key !== "number" || !Object.hasOwn(this.types, key)) {
        return undefined;
      }

      return this.types[key];
    }

    if (typeof key === "string") {
      if (Object.hasOwn(this.types, key)) {
        return this.types[key];
      }

      const prefixedName = `:${key}`;
      if (Object.hasOwn(this.types, prefixedName)) {
        return this.types[prefixedName];
      }
    }

    return undefined;
  }

  private appendTypedParameter(values: unknown[], type: QueryScalarParameterType): void {
    this.convertedSQL.push(new Array(values.length).fill("?").join(", "));

    for (const value of values) {
      this.convertedParameters.push(value);
      this.convertedTypes.push(type);
    }
  }

  private acceptParameterStyle(nextStyle: ParameterStyle): void {
    if (this.parameterStyle === "none") {
      this.parameterStyle = nextStyle;
      return;
    }

    if (this.parameterStyle !== nextStyle) {
      throw new MixedParameterStyleException();
    }
  }

  private isArrayParameterType(type: QueryParameterType): type is ArrayParameterType {
    return (
      type === ArrayParameterType.INTEGER ||
      type === ArrayParameterType.STRING ||
      type === ArrayParameterType.ASCII ||
      type === ArrayParameterType.BINARY
    );
  }
}
