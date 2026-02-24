import { ColumnCase } from "../column-case";

type AssociativeRow = Record<string, unknown>;
type NumericRow = unknown[];

type ValueConverter = (value: unknown) => unknown;
type RowConverter = ((row: AssociativeRow) => AssociativeRow) | ((row: NumericRow) => NumericRow);
type ArrayConverter = (value: unknown[]) => unknown[];

export class Converter {
  private readonly convertNumericFn: (row: NumericRow | false) => NumericRow | false;
  private readonly convertAssociativeFn: (row: AssociativeRow | false) => AssociativeRow | false;
  private readonly convertOneFn: (value: unknown) => unknown;
  private readonly convertAllNumericFn: (rows: NumericRow[]) => NumericRow[];
  private readonly convertAllAssociativeFn: (rows: AssociativeRow[]) => AssociativeRow[];
  private readonly convertFirstColumnFn: (values: unknown[]) => unknown[];
  private readonly convertColumnNameFn: (name: string) => string;

  public constructor(
    private readonly emptyStringToNullEnabled: boolean,
    private readonly rightTrimStringEnabled: boolean,
    private readonly columnCase: ColumnCase | null,
  ) {
    const convertValue = this.createConvertValue(
      this.emptyStringToNullEnabled,
      this.rightTrimStringEnabled,
    );
    const convertNumericRow = this.createConvertRow(convertValue, null);
    const convertAssociativeRow = this.createConvertRow(convertValue, this.columnCase);

    this.convertNumericFn = this.createConvert(convertNumericRow) as (
      row: NumericRow | false,
    ) => NumericRow | false;
    this.convertAssociativeFn = this.createConvert(convertAssociativeRow) as (
      row: AssociativeRow | false,
    ) => AssociativeRow | false;
    this.convertOneFn = this.createConvert(convertValue);

    this.convertAllNumericFn = this.createConvertAll(convertNumericRow) as (
      rows: NumericRow[],
    ) => NumericRow[];
    this.convertAllAssociativeFn = this.createConvertAll(convertAssociativeRow) as (
      rows: AssociativeRow[],
    ) => AssociativeRow[];
    this.convertFirstColumnFn = this.createConvertAll(convertValue) as (
      values: unknown[],
    ) => unknown[];

    this.convertColumnNameFn =
      this.columnCase === ColumnCase.LOWER
        ? (name) => name.toLowerCase()
        : this.columnCase === ColumnCase.UPPER
          ? (name) => name.toUpperCase()
          : (name) => name;
  }

  public convertNumeric<T = unknown>(row: T[] | false): T[] | false {
    return this.convertNumericFn(row as NumericRow | false) as T[] | false;
  }

  public convertAssociative<T extends AssociativeRow = AssociativeRow>(row: T | false): T | false {
    return this.convertAssociativeFn(row as AssociativeRow | false) as T | false;
  }

  public convertOne<T = unknown>(value: T): T {
    return this.convertOneFn(value) as T;
  }

  public convertAllNumeric<T = unknown>(rows: T[][]): T[][] {
    return this.convertAllNumericFn(rows as NumericRow[]) as T[][];
  }

  public convertAllAssociative<T extends AssociativeRow = AssociativeRow>(rows: T[]): T[] {
    return this.convertAllAssociativeFn(rows as AssociativeRow[]) as T[];
  }

  public convertFirstColumn<T = unknown>(values: T[]): T[] {
    return this.convertFirstColumnFn(values as unknown[]) as T[];
  }

  public convertRow(row: AssociativeRow): AssociativeRow {
    return (this.convertAssociative(row) ?? row) as AssociativeRow;
  }

  public convertColumnName(name: string): string {
    return this.convertColumnNameFn(name);
  }

  public convertValue(value: unknown): unknown {
    return this.convertOne(value);
  }

  private static id<T>(value: T): T {
    return value;
  }

  private static convertEmptyStringToNull<T>(value: T): T | null {
    if (value === "") {
      return null;
    }

    return value;
  }

  private static rightTrimString<T>(value: T): T | string {
    if (typeof value !== "string") {
      return value;
    }

    return value.trimEnd();
  }

  private createConvertValue(
    convertEmptyStringToNull: boolean,
    rightTrimString: boolean,
  ): ValueConverter | null {
    const functions: ValueConverter[] = [];

    if (convertEmptyStringToNull) {
      functions.push((value) => Converter.convertEmptyStringToNull(value));
    }

    if (rightTrimString) {
      functions.push((value) => Converter.rightTrimString(value));
    }

    return this.compose(...functions);
  }

  private createConvertRow(
    function_: ValueConverter | null,
    caseMode: ColumnCase | null,
  ): RowConverter | null {
    const functions: Array<(row: AssociativeRow | NumericRow) => AssociativeRow | NumericRow> = [];

    if (function_ !== null) {
      functions.push(this.createMapper(function_));
    }

    if (caseMode !== null) {
      functions.push((row) => {
        if (Array.isArray(row)) {
          return row;
        }

        const converted: AssociativeRow = {};
        for (const [key, value] of Object.entries(row)) {
          const nextKey = caseMode === ColumnCase.LOWER ? key.toLowerCase() : key.toUpperCase();
          converted[nextKey] = value;
        }

        return converted;
      });
    }

    return this.compose(...functions) as RowConverter | null;
  }

  private createConvert(
    function_: ((value: unknown) => unknown) | null,
  ): (value: unknown) => unknown {
    if (function_ === null) {
      return Converter.id;
    }

    return (value: unknown): unknown => {
      if (value === false) {
        return false;
      }

      return function_(value);
    };
  }

  private createConvertAll(function_: ((value: unknown) => unknown) | null): ArrayConverter {
    if (function_ === null) {
      return Converter.id as ArrayConverter;
    }

    return this.createMapper(function_) as ArrayConverter;
  }

  private createMapper(
    function_: (value: unknown) => unknown,
  ): (value: AssociativeRow | unknown[]) => AssociativeRow | unknown[] {
    return (value) => {
      if (Array.isArray(value)) {
        return value.map((item) => function_(item));
      }

      const converted: AssociativeRow = {};
      for (const [key, item] of Object.entries(value)) {
        converted[key] = function_(item);
      }

      return converted;
    };
  }

  private compose(
    ...functions: Array<(value: unknown) => unknown>
  ): ((value: unknown) => unknown) | null {
    if (functions.length === 0) {
      return null;
    }

    return functions.reduce<(value: unknown) => unknown>(
      (carry, item) => (value: unknown) => item(carry(value)),
      Converter.id,
    );
  }
}
