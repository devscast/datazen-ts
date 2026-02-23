import { ColumnCase } from "../column-case";

export class Converter {
  constructor(
    private readonly convertEmptyStringToNull: boolean,
    private readonly rightTrimString: boolean,
    private readonly columnCase: ColumnCase | null,
  ) {}

  public convertRow(row: Record<string, unknown>): Record<string, unknown> {
    if (!this.convertEmptyStringToNull && !this.rightTrimString && this.columnCase === null) {
      return row;
    }

    const converted: Record<string, unknown> = {};

    for (const [name, value] of Object.entries(row)) {
      converted[this.convertColumnName(name)] = this.convertValue(value);
    }

    return converted;
  }

  public convertColumnName(name: string): string {
    if (this.columnCase === ColumnCase.LOWER) {
      return name.toLowerCase();
    }

    if (this.columnCase === ColumnCase.UPPER) {
      return name.toUpperCase();
    }

    return name;
  }

  public convertValue(value: unknown): unknown {
    if (this.convertEmptyStringToNull && value === "") {
      return null;
    }

    if (this.rightTrimString && typeof value === "string") {
      return value.trimEnd();
    }

    return value;
  }
}
