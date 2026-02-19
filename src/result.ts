import type { DriverQueryResult } from "./driver";
import { NoKeyValueError } from "./exception/index";

type AssociativeRow = Record<string, unknown>;
type NumericRow = unknown[];

export class Result {
  private rows: AssociativeRow[];
  private cursor = 0;
  private readonly explicitColumns: string[];
  private readonly explicitRowCount?: number;

  constructor(result: DriverQueryResult) {
    this.rows = [...result.rows];
    this.explicitColumns = result.columns ?? [];
    this.explicitRowCount = result.rowCount;
  }

  public fetchNumeric<T extends NumericRow = NumericRow>(): T | false {
    const row = this.fetchAssociative();
    if (row === false) {
      return false;
    }

    const columns = this.getColumnsFromRow(row);
    return columns.map((column) => row[column]) as T;
  }

  public fetchAssociative<T extends AssociativeRow = AssociativeRow>(): T | false {
    const row = this.rows[this.cursor];
    if (row === undefined) {
      return false;
    }

    this.cursor += 1;
    return { ...row } as T;
  }

  public fetchOne<T = unknown>(): T | false {
    const row = this.fetchNumeric();
    if (row === false) {
      return false;
    }

    const value = row[0];
    return value === undefined ? false : (value as T);
  }

  public fetchAllNumeric<T extends NumericRow = NumericRow>(): T[] {
    const rows: T[] = [];
    let row = this.fetchNumeric<T>();

    while (row !== false) {
      rows.push(row);
      row = this.fetchNumeric<T>();
    }

    return rows;
  }

  public fetchAllAssociative<T extends AssociativeRow = AssociativeRow>(): T[] {
    const rows: T[] = [];
    let row = this.fetchAssociative<T>();

    while (row !== false) {
      rows.push(row);
      row = this.fetchAssociative<T>();
    }

    return rows;
  }

  public fetchAllKeyValue<T = unknown>(): Record<string, T> {
    this.ensureHasKeyValue();

    const rows = this.fetchAllNumeric();
    const data: Record<string, T> = {};

    for (const row of rows) {
      const key = row[0];
      if (key === undefined) {
        continue;
      }

      data[String(key)] = row[1] as T;
    }

    return data;
  }

  public fetchAllAssociativeIndexed<T extends AssociativeRow = AssociativeRow>(): Record<
    string,
    T
  > {
    const rows = this.fetchAllAssociative();
    const indexed: Record<string, T> = {};

    for (const row of rows) {
      const columns = this.getColumnsFromRow(row);
      const keyColumn = columns[0];
      if (keyColumn === undefined) {
        continue;
      }

      const key = row[keyColumn];
      const clone = { ...row };
      delete clone[keyColumn];
      indexed[String(key)] = clone as T;
    }

    return indexed;
  }

  public fetchFirstColumn<T = unknown>(): T[] {
    const values: T[] = [];
    let value = this.fetchOne<T>();

    while (value !== false) {
      values.push(value);
      value = this.fetchOne<T>();
    }

    return values;
  }

  public rowCount(): number {
    return this.explicitRowCount ?? this.rows.length;
  }

  public columnCount(): number {
    const row = this.rows[0];
    if (row === undefined) {
      return this.explicitColumns.length;
    }

    return this.getColumnsFromRow(row).length;
  }

  public getColumnName(index: number): string {
    const columns = this.getColumns();
    const column = columns[index];

    if (column === undefined) {
      throw new RangeError(`Column index ${index} is out of bounds.`);
    }

    return column;
  }

  public free(): void {
    this.rows = [];
    this.cursor = 0;
  }

  private getColumnsFromRow(row: AssociativeRow): string[] {
    return this.explicitColumns.length > 0 ? this.explicitColumns : Object.keys(row);
  }

  private getColumns(): string[] {
    const row = this.rows[0];
    if (row !== undefined) {
      return this.getColumnsFromRow(row);
    }

    return this.explicitColumns;
  }

  private ensureHasKeyValue(): void {
    const columnCount = this.columnCount();

    if (columnCount < 2) {
      throw new NoKeyValueError(columnCount);
    }
  }
}
