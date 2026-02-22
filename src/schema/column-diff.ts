import { Column } from "./column";

export class ColumnDiff {
  constructor(
    public readonly oldColumn: Column,
    public readonly newColumn: Column,
    public readonly changedProperties: readonly string[],
  ) {}

  public hasChanges(): boolean {
    return this.changedProperties.length > 0;
  }
}
