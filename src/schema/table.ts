import { Type } from "../types/type";
import { AbstractAsset } from "./abstract-asset";
import type { ColumnOptions } from "./column";
import { Column } from "./column";
import { ColumnAlreadyExists } from "./exception/column-already-exists";
import { ColumnDoesNotExist } from "./exception/column-does-not-exist";
import { ForeignKeyDoesNotExist } from "./exception/foreign-key-does-not-exist";
import { IndexAlreadyExists } from "./exception/index-already-exists";
import { IndexDoesNotExist } from "./exception/index-does-not-exist";
import { InvalidState } from "./exception/invalid-state";
import { PrimaryKeyAlreadyExists } from "./exception/primary-key-already-exists";
import { ForeignKeyConstraint } from "./foreign-key-constraint";
import { Index } from "./index";
import { TableEditor } from "./table-editor";

export class Table extends AbstractAsset {
  private readonly columns: Record<string, Column> = {};
  private readonly indexes: Record<string, Index> = {};
  private readonly foreignKeys: Record<string, ForeignKeyConstraint> = {};
  private options: Record<string, unknown>;
  private primaryKeyName: string | null = null;

  constructor(
    name: string,
    columns: Column[] = [],
    indexes: Index[] = [],
    foreignKeys: ForeignKeyConstraint[] = [],
    options: Record<string, unknown> = {},
  ) {
    super(name);
    this.options = { ...options };

    for (const column of columns) {
      this.columns[getAssetKey(column.getName())] = column;
    }

    for (const index of indexes) {
      this.addIndexObject(index);
    }

    for (const foreignKey of foreignKeys) {
      this.addForeignKeyObject(foreignKey);
    }
  }

  public addColumn(name: string, type: string | Type, options: ColumnOptions = {}): Column {
    if (this.hasColumn(name)) {
      throw ColumnAlreadyExists.new(this.getName(), name);
    }

    const column = new Column(name, type, options);
    this.columns[getAssetKey(name)] = column;
    return column;
  }

  public changeColumn(name: string, options: ColumnOptions): Column {
    const column = this.getColumn(name);
    column.setOptions(options);
    return column;
  }

  public hasColumn(name: string): boolean {
    return Object.hasOwn(this.columns, getAssetKey(name));
  }

  public getColumn(name: string): Column {
    const key = getAssetKey(name);
    const column = this.columns[key];

    if (column === undefined) {
      throw ColumnDoesNotExist.new(name, this.getName());
    }

    return column;
  }

  public getColumns(): Column[] {
    return Object.values(this.columns);
  }

  public dropColumn(name: string): void {
    delete this.columns[getAssetKey(name)];
  }

  public addIndex(
    columnNames: string[],
    indexName?: string,
    flags: string[] = [],
    options: Record<string, unknown> = {},
  ): Index {
    const name = indexName ?? this._generateIdentifierName(columnNames, "idx", 30);
    const index = new Index(name, columnNames, false, false, flags, options);
    this.addIndexObject(index);
    return index;
  }

  public addUniqueIndex(
    columnNames: string[],
    indexName?: string,
    options: Record<string, unknown> = {},
  ): Index {
    const name = indexName ?? this._generateIdentifierName(columnNames, "uniq", 30);
    const index = new Index(name, columnNames, true, false, [], options);
    this.addIndexObject(index);
    return index;
  }

  public setPrimaryKey(columnNames: string[], indexName?: string): Index {
    if (this.hasPrimaryKey()) {
      throw PrimaryKeyAlreadyExists.new(this.getName());
    }

    const name = indexName ?? this._generateIdentifierName(columnNames, "primary", 30);
    const index = new Index(name, columnNames, true, true);
    this.primaryKeyName = name;
    this.addIndexObject(index);
    return index;
  }

  public hasPrimaryKey(): boolean {
    return this.primaryKeyName !== null && this.hasIndex(this.primaryKeyName);
  }

  public getPrimaryKey(): Index {
    if (this.primaryKeyName === null) {
      throw InvalidState.tableHasInvalidPrimaryKeyConstraint(this.getName());
    }

    return this.getIndex(this.primaryKeyName);
  }

  public getPrimaryKeyColumns(): string[] {
    if (!this.hasPrimaryKey()) {
      return [];
    }

    return this.getPrimaryKey().getColumns();
  }

  public addIndexObject(index: Index): void {
    const key = getAssetKey(index.getName());
    if (Object.hasOwn(this.indexes, key)) {
      throw IndexAlreadyExists.new(index.getName(), this.getName());
    }

    this.indexes[key] = index;

    if (index.isPrimary()) {
      this.primaryKeyName = index.getName();
    }
  }

  public hasIndex(name: string): boolean {
    return Object.hasOwn(this.indexes, getAssetKey(name));
  }

  public getIndex(name: string): Index {
    const key = getAssetKey(name);
    const index = this.indexes[key];

    if (index === undefined) {
      throw IndexDoesNotExist.new(name, this.getName());
    }

    return index;
  }

  public getIndexes(): Index[] {
    return Object.values(this.indexes);
  }

  public dropIndex(name: string): void {
    if (!this.hasIndex(name)) {
      throw IndexDoesNotExist.new(name, this.getName());
    }

    if (this.primaryKeyName !== null && getAssetKey(this.primaryKeyName) === getAssetKey(name)) {
      this.primaryKeyName = null;
    }

    delete this.indexes[getAssetKey(name)];
  }

  public addForeignKeyConstraint(
    foreignTableName: string,
    localColumnNames: string[],
    foreignColumnNames: string[],
    options: Record<string, unknown> = {},
    name?: string,
  ): ForeignKeyConstraint {
    const constraintName = name ?? this._generateIdentifierName(localColumnNames, "fk", 30);
    const foreignKey = new ForeignKeyConstraint(
      localColumnNames,
      foreignTableName,
      foreignColumnNames,
      constraintName,
      options,
      this.getName(),
    );

    this.addForeignKeyObject(foreignKey);
    return foreignKey;
  }

  public addForeignKeyObject(foreignKey: ForeignKeyConstraint): void {
    const key = getAssetKey(foreignKey.getName());
    this.foreignKeys[key] = foreignKey;
  }

  public hasForeignKey(name: string): boolean {
    return Object.hasOwn(this.foreignKeys, getAssetKey(name));
  }

  public getForeignKey(name: string): ForeignKeyConstraint {
    const key = getAssetKey(name);
    const foreignKey = this.foreignKeys[key];

    if (foreignKey === undefined) {
      throw ForeignKeyDoesNotExist.new(name, this.getName());
    }

    return foreignKey;
  }

  public getForeignKeys(): ForeignKeyConstraint[] {
    return Object.values(this.foreignKeys);
  }

  public removeForeignKey(name: string): void {
    if (!this.hasForeignKey(name)) {
      throw ForeignKeyDoesNotExist.new(name, this.getName());
    }

    delete this.foreignKeys[getAssetKey(name)];
  }

  public addOption(name: string, value: unknown): this {
    this.options[name] = value;
    return this;
  }

  public hasOption(name: string): boolean {
    return Object.hasOwn(this.options, name);
  }

  public getOption(name: string): unknown {
    return this.options[name];
  }

  public getOptions(): Record<string, unknown> {
    return { ...this.options };
  }

  public static editor(): TableEditor {
    return new TableEditor();
  }

  public edit(): TableEditor {
    return Table.editor()
      .setName(this.getName())
      .setColumns(...this.getColumns())
      .setIndexes(...this.getIndexes())
      .setForeignKeyConstraints(...this.getForeignKeys())
      .setOptions(this.getOptions());
  }
}

function getAssetKey(name: string): string {
  return name.toLowerCase();
}
