import { Column } from "./column";
import { ColumnDiff } from "./column-diff";
import { ComparatorConfig } from "./comparator-config";
import { Schema } from "./schema";
import { SchemaDiff } from "./schema-diff";
import { Table } from "./table";
import { TableDiff } from "./table-diff";

export class Comparator {
  constructor(private readonly config: ComparatorConfig = new ComparatorConfig()) {}

  public compareSchemas(oldSchema: Schema, newSchema: Schema): SchemaDiff {
    const oldTablesByName = new Map(oldSchema.getTables().map((table) => [table.getName(), table]));
    const newTablesByName = new Map(newSchema.getTables().map((table) => [table.getName(), table]));

    const createdTables: Table[] = [];
    const alteredTables: TableDiff[] = [];
    const droppedTables: Table[] = [];

    for (const [name, newTable] of newTablesByName) {
      const oldTable = oldTablesByName.get(name);
      if (oldTable === undefined) {
        createdTables.push(newTable);
        continue;
      }

      const diff = this.compareTables(oldTable, newTable);
      if (diff?.hasChanges()) {
        alteredTables.push(diff);
      }
    }

    for (const [name, oldTable] of oldTablesByName) {
      if (!newTablesByName.has(name)) {
        droppedTables.push(oldTable);
      }
    }

    const oldSequencesByName = new Map(
      oldSchema.getSequences().map((sequence) => [sequence.getName(), sequence]),
    );
    const newSequencesByName = new Map(
      newSchema.getSequences().map((sequence) => [sequence.getName(), sequence]),
    );

    const createdSequences = [...newSequencesByName.entries()]
      .filter(([name]) => !oldSequencesByName.has(name))
      .map(([, sequence]) => sequence);

    const droppedSequences = [...oldSequencesByName.entries()]
      .filter(([name]) => !newSequencesByName.has(name))
      .map(([, sequence]) => sequence);

    return new SchemaDiff({
      alteredTables,
      createdSequences,
      createdTables,
      droppedSequences,
      droppedTables,
    });
  }

  public compareTables(oldTable: Table, newTable: Table): TableDiff | null {
    const oldColumnsByName = new Map(
      oldTable.getColumns().map((column) => [column.getName(), column]),
    );
    const newColumnsByName = new Map(
      newTable.getColumns().map((column) => [column.getName(), column]),
    );

    const addedColumns: Column[] = [];
    const changedColumns: ColumnDiff[] = [];
    const droppedColumns: Column[] = [];

    for (const [name, newColumn] of newColumnsByName) {
      const oldColumn = oldColumnsByName.get(name);
      if (oldColumn === undefined) {
        addedColumns.push(newColumn);
        continue;
      }

      const columnDiff = this.compareColumns(oldColumn, newColumn);
      if (columnDiff !== null) {
        changedColumns.push(columnDiff);
      }
    }

    for (const [name, oldColumn] of oldColumnsByName) {
      if (!newColumnsByName.has(name)) {
        droppedColumns.push(oldColumn);
      }
    }

    const addedIndexes = newTable
      .getIndexes()
      .filter(
        (index) =>
          !oldTable.getIndexes().some((oldIndex) => oldIndex.getName() === index.getName()),
      );

    const droppedIndexes = oldTable
      .getIndexes()
      .filter(
        (index) =>
          !newTable.getIndexes().some((newIndex) => newIndex.getName() === index.getName()),
      );

    const addedForeignKeys = newTable.getForeignKeys().filter((foreignKey) => {
      return !oldTable
        .getForeignKeys()
        .some((oldForeignKey) => oldForeignKey.getName() === foreignKey.getName());
    });

    const droppedForeignKeys = oldTable.getForeignKeys().filter((foreignKey) => {
      return !newTable
        .getForeignKeys()
        .some((newForeignKey) => newForeignKey.getName() === foreignKey.getName());
    });

    const diff = new TableDiff(oldTable, newTable, {
      addedColumns,
      addedForeignKeys,
      addedIndexes,
      changedColumns,
      droppedColumns,
      droppedForeignKeys,
      droppedIndexes,
    });

    if (!diff.hasChanges() && !this.config.isDetectColumnRenamesEnabled()) {
      return null;
    }

    return diff;
  }

  public compareColumns(oldColumn: Column, newColumn: Column): ColumnDiff | null {
    const changedProperties: string[] = [];

    if (oldColumn.getType().constructor !== newColumn.getType().constructor) {
      changedProperties.push("type");
    }

    if (oldColumn.getLength() !== newColumn.getLength()) {
      changedProperties.push("length");
    }

    if (oldColumn.getPrecision() !== newColumn.getPrecision()) {
      changedProperties.push("precision");
    }

    if (oldColumn.getScale() !== newColumn.getScale()) {
      changedProperties.push("scale");
    }

    if (oldColumn.getUnsigned() !== newColumn.getUnsigned()) {
      changedProperties.push("unsigned");
    }

    if (oldColumn.getFixed() !== newColumn.getFixed()) {
      changedProperties.push("fixed");
    }

    if (oldColumn.getNotnull() !== newColumn.getNotnull()) {
      changedProperties.push("notnull");
    }

    if (oldColumn.getAutoincrement() !== newColumn.getAutoincrement()) {
      changedProperties.push("autoincrement");
    }

    if (oldColumn.getDefault() !== newColumn.getDefault()) {
      changedProperties.push("default");
    }

    if (oldColumn.getComment() !== newColumn.getComment()) {
      changedProperties.push("comment");
    }

    if (changedProperties.length === 0) {
      return null;
    }

    return new ColumnDiff(oldColumn, newColumn, changedProperties);
  }
}
