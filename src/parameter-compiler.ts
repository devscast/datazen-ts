import { ArrayParameterType } from "./array-parameter-type";
import { ParameterBindingStyle } from "./driver";
import {
  InvalidParameterError,
  MissingNamedParameterError,
  MissingPositionalParameterError,
  MixedParameterStyleError,
} from "./exception/index";
import { ParameterType } from "./parameter-type";
import { Query } from "./query";
import { Parser, type SQLParser, type Visitor } from "./sql/parser";
import type {
  CompiledQuery,
  QueryParameterType,
  QueryParameterTypes,
  QueryParameters,
  QueryScalarParameterType,
} from "./types";

interface CompileContext {
  sqlParts: string[];
  boundValues: unknown[];
  boundTypes: QueryScalarParameterType[];
  namedBoundValues: Record<string, unknown>;
  namedBoundTypes: Record<string, QueryScalarParameterType>;
  positionalIndex: number;
  bindCounter: number;
  usedNamedParameter: boolean;
  usedPositionalParameter: boolean;
}

export class ParameterCompiler {
  constructor(private readonly parser: SQLParser = new Parser(true)) {}

  public compile(
    sql: string,
    params: QueryParameters = [],
    types: QueryParameterTypes = [],
    bindingStyle: ParameterBindingStyle = ParameterBindingStyle.POSITIONAL,
  ): CompiledQuery {
    const context: CompileContext = {
      bindCounter: 0,
      boundTypes: [],
      boundValues: [],
      namedBoundTypes: {},
      namedBoundValues: {},
      positionalIndex: 0,
      sqlParts: [],
      usedNamedParameter: false,
      usedPositionalParameter: false,
    };

    this.compileSQL(sql, params, types, bindingStyle, context);

    if (context.usedNamedParameter && context.usedPositionalParameter) {
      throw new MixedParameterStyleError();
    }

    if (bindingStyle === ParameterBindingStyle.NAMED) {
      return {
        parameters: context.namedBoundValues,
        sql: context.sqlParts.join(""),
        types: context.namedBoundTypes,
      };
    }

    return {
      parameters: context.boundValues,
      sql: context.sqlParts.join(""),
      types: context.boundTypes,
    };
  }

  public compileFromQuery(
    query: Query,
    bindingStyle: ParameterBindingStyle = ParameterBindingStyle.POSITIONAL,
  ): CompiledQuery {
    return this.compile(query.sql, query.parameters, query.types, bindingStyle);
  }

  private compileSQL(
    sql: string,
    params: QueryParameters,
    types: QueryParameterTypes,
    bindingStyle: ParameterBindingStyle,
    context: CompileContext,
  ): void {
    const visitor: Visitor = {
      acceptNamedParameter: (fragment: string): void => {
        const namedParameter = fragment.slice(1);
        context.usedNamedParameter = true;

        const value = this.readNamedValue(namedParameter, params);
        const type = this.readNamedType(namedParameter, types);
        this.appendBoundValue(value, type, bindingStyle, context);
      },
      acceptOther: (fragment: string): void => {
        context.sqlParts.push(fragment);
      },
      acceptPositionalParameter: (): void => {
        context.usedPositionalParameter = true;
        const index = context.positionalIndex;
        const value = this.readPositionalValue(index, params);
        const type = this.readPositionalType(index, types);
        this.appendBoundValue(value, type, bindingStyle, context);
        context.positionalIndex += 1;
      },
    };

    this.parser.parse(sql, visitor);
  }

  private appendBoundValue(
    value: unknown,
    type: QueryParameterType | undefined,
    bindingStyle: ParameterBindingStyle,
    context: CompileContext,
  ): void {
    const parameterType = type ?? ParameterType.STRING;

    if (Array.isArray(value)) {
      if (!this.isArrayParameterType(parameterType)) {
        throw new InvalidParameterError("Array values require an ArrayParameterType binding.");
      }

      if (value.length === 0) {
        context.sqlParts.push("NULL");
        return;
      }

      const scalarType = ArrayParameterType.toElementParameterType(parameterType);
      const placeholders = value.map((element) =>
        this.appendScalarBoundValue(element, scalarType, bindingStyle, context),
      );

      context.sqlParts.push(placeholders.join(", "));
      return;
    }

    context.sqlParts.push(this.appendScalarBoundValue(value, parameterType, bindingStyle, context));
  }

  private appendScalarBoundValue(
    value: unknown,
    type: QueryScalarParameterType,
    bindingStyle: ParameterBindingStyle,
    context: CompileContext,
  ): string {
    if (bindingStyle === ParameterBindingStyle.NAMED) {
      context.bindCounter += 1;
      const placeholder = `p${context.bindCounter}`;
      context.namedBoundValues[placeholder] = value;
      context.namedBoundTypes[placeholder] = type;
      return `@${placeholder}`;
    }

    context.boundValues.push(value);
    context.boundTypes.push(type);
    return "?";
  }

  private readNamedValue(name: string, params: QueryParameters): unknown {
    if (Array.isArray(params)) {
      throw new MixedParameterStyleError();
    }

    if (Object.hasOwn(params, name)) {
      return params[name];
    }

    const prefixedName = `:${name}`;
    if (Object.hasOwn(params, prefixedName)) {
      return params[prefixedName];
    }

    throw new MissingNamedParameterError(name);
  }

  private readNamedType(name: string, types: QueryParameterTypes): QueryParameterType | undefined {
    if (Array.isArray(types)) {
      return undefined;
    }

    if (Object.hasOwn(types, name)) {
      return types[name];
    }

    const prefixedName = `:${name}`;
    if (Object.hasOwn(types, prefixedName)) {
      return types[prefixedName];
    }

    return undefined;
  }

  private readPositionalValue(index: number, params: QueryParameters): unknown {
    if (!Array.isArray(params)) {
      throw new MixedParameterStyleError();
    }

    if (!Object.hasOwn(params, index)) {
      throw new MissingPositionalParameterError(index);
    }

    return params[index];
  }

  private readPositionalType(
    index: number,
    types: QueryParameterTypes,
  ): QueryParameterType | undefined {
    if (!Array.isArray(types)) {
      return undefined;
    }

    if (!Object.hasOwn(types, index)) {
      return undefined;
    }

    return types[index];
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
