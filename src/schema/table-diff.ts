import { Column } from "./column";
import { ColumnDiff } from "./column-diff";
import { ForeignKeyConstraint } from "./foreign-key-constraint";
import { Index } from "./index";
import { Table } from "./table";

export interface TableDiffOptions {
  addedColumns?: Column[];
  changedColumns?: ColumnDiff[];
  droppedColumns?: Column[];
  addedIndexes?: Index[];
  droppedIndexes?: Index[];
  addedForeignKeys?: ForeignKeyConstraint[];
  droppedForeignKeys?: ForeignKeyConstraint[];
}

export class TableDiff {
  public readonly addedColumns: readonly Column[];
  public readonly changedColumns: readonly ColumnDiff[];
  public readonly droppedColumns: readonly Column[];
  public readonly addedIndexes: readonly Index[];
  public readonly droppedIndexes: readonly Index[];
  public readonly addedForeignKeys: readonly ForeignKeyConstraint[];
  public readonly droppedForeignKeys: readonly ForeignKeyConstraint[];

  constructor(
    public readonly oldTable: Table,
    public readonly newTable: Table,
    options: TableDiffOptions = {},
  ) {
    this.addedColumns = options.addedColumns ?? [];
    this.changedColumns = options.changedColumns ?? [];
    this.droppedColumns = options.droppedColumns ?? [];
    this.addedIndexes = options.addedIndexes ?? [];
    this.droppedIndexes = options.droppedIndexes ?? [];
    this.addedForeignKeys = options.addedForeignKeys ?? [];
    this.droppedForeignKeys = options.droppedForeignKeys ?? [];
  }

  public hasChanges(): boolean {
    return (
      this.addedColumns.length > 0 ||
      this.changedColumns.length > 0 ||
      this.droppedColumns.length > 0 ||
      this.addedIndexes.length > 0 ||
      this.droppedIndexes.length > 0 ||
      this.addedForeignKeys.length > 0 ||
      this.droppedForeignKeys.length > 0
    );
  }
}
