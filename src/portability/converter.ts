import { ColumnCase } from "../column-case";
import type { DriverQueryResult } from "../driver";

export class Converter {
  constructor(
    private readonly convertEmptyStringToNull: boolean,
    private readonly rightTrimString: boolean,
    private readonly columnCase: ColumnCase | null,
  ) {}

  public convertQueryResult(result: DriverQueryResult): DriverQueryResult {
    const rows =
      this.columnCase === null && !this.convertEmptyStringToNull && !this.rightTrimString
        ? result.rows
        : result.rows.map((row) => this.convertRow(row));

    const columns =
      result.columns === undefined
        ? undefined
        : result.columns.map((name) => this.convertColumnName(name));

    return {
      columns,
      rowCount: result.rowCount,
      rows,
    };
  }

  private convertRow(row: Record<string, unknown>): Record<string, unknown> {
    if (!this.convertEmptyStringToNull && !this.rightTrimString && this.columnCase === null) {
      return row;
    }

    const converted: Record<string, unknown> = {};

    for (const [name, value] of Object.entries(row)) {
      converted[this.convertColumnName(name)] = this.convertValue(value);
    }

    return converted;
  }

  private convertColumnName(name: string): string {
    if (this.columnCase === ColumnCase.LOWER) {
      return name.toLowerCase();
    }

    if (this.columnCase === ColumnCase.UPPER) {
      return name.toUpperCase();
    }

    return name;
  }

  private convertValue(value: unknown): unknown {
    if (this.convertEmptyStringToNull && value === "") {
      return null;
    }

    if (this.rightTrimString && typeof value === "string") {
      return value.trimEnd();
    }

    return value;
  }
}
