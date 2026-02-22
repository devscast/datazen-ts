import { Column } from "./column";
import { InvalidTableDefinition } from "./exception/index";
import { ForeignKeyConstraint } from "./foreign-key-constraint";
import { Index } from "./index";
import { PrimaryKeyConstraint } from "./primary-key-constraint";
import { Table } from "./table";
import { UniqueConstraint } from "./unique-constraint";

export class TableEditor {
  private name: string | null = null;
  private columns: Column[] = [];
  private indexes: Index[] = [];
  private primaryKeyConstraint: PrimaryKeyConstraint | null = null;
  private uniqueConstraints: UniqueConstraint[] = [];
  private foreignKeyConstraints: ForeignKeyConstraint[] = [];
  private options: Record<string, unknown> = {};

  public setName(name: string): this {
    this.name = name;
    return this;
  }

  public setColumns(...columns: Column[]): this {
    this.columns = [...columns];
    return this;
  }

  public addColumn(column: Column): this {
    this.columns.push(column);
    return this;
  }

  public setIndexes(...indexes: Index[]): this {
    this.indexes = [...indexes];
    return this;
  }

  public addIndex(index: Index): this {
    this.indexes.push(index);
    return this;
  }

  public setPrimaryKeyConstraint(primaryKeyConstraint: PrimaryKeyConstraint | null): this {
    this.primaryKeyConstraint = primaryKeyConstraint;
    return this;
  }

  public setUniqueConstraints(...uniqueConstraints: UniqueConstraint[]): this {
    this.uniqueConstraints = [...uniqueConstraints];
    return this;
  }

  public addUniqueConstraint(uniqueConstraint: UniqueConstraint): this {
    this.uniqueConstraints.push(uniqueConstraint);
    return this;
  }

  public setForeignKeyConstraints(...foreignKeyConstraints: ForeignKeyConstraint[]): this {
    this.foreignKeyConstraints = [...foreignKeyConstraints];
    return this;
  }

  public addForeignKeyConstraint(foreignKeyConstraint: ForeignKeyConstraint): this {
    this.foreignKeyConstraints.push(foreignKeyConstraint);
    return this;
  }

  public setOptions(options: Record<string, unknown>): this {
    this.options = { ...options };
    return this;
  }

  public create(): Table {
    if (this.name === null) {
      throw InvalidTableDefinition.nameNotSet();
    }

    if (this.columns.length === 0) {
      throw InvalidTableDefinition.columnsNotSet(this.name);
    }

    const table = new Table(this.name, this.columns, this.indexes, this.foreignKeyConstraints, {
      ...this.options,
    });

    if (this.primaryKeyConstraint !== null) {
      const indexName = this.primaryKeyConstraint.getObjectName() ?? undefined;
      table.setPrimaryKey(this.primaryKeyConstraint.getColumnNames(), indexName);
    }

    for (const uniqueConstraint of this.uniqueConstraints) {
      table.addUniqueIndex(
        uniqueConstraint.getColumnNames(),
        uniqueConstraint.getObjectName() || undefined,
        uniqueConstraint.getOptions(),
      );
    }

    return table;
  }
}
