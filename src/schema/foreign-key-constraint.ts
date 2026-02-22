import type { AbstractPlatform } from "../platforms/abstract-platform";
import { AbstractAsset } from "./abstract-asset";
import { ForeignKeyConstraintEditor } from "./foreign-key-constraint-editor";
import { Identifier } from "./identifier";

export class ForeignKeyConstraint extends AbstractAsset {
  private readonly localColumns: Identifier[];
  private readonly foreignColumns: Identifier[];

  constructor(
    localColumnNames: string[],
    private readonly foreignTableName: string,
    foreignColumnNames: string[],
    name: string | null = null,
    private readonly options: Record<string, unknown> = {},
    private localTableName: string | null = null,
  ) {
    super(name ?? "");
    this.localColumns = localColumnNames.map((columnName) => new Identifier(columnName));
    this.foreignColumns = foreignColumnNames.map((columnName) => new Identifier(columnName));
  }

  public getLocalTableName(): string | null {
    return this.localTableName;
  }

  public setLocalTableName(localTableName: string): this {
    this.localTableName = localTableName;
    return this;
  }

  public getForeignTableName(): string {
    return this.foreignTableName;
  }

  public getColumns(): string[] {
    return this.localColumns.map((column) => column.getName());
  }

  public getReferencingColumnNames(): string[] {
    return this.getColumns();
  }

  public getQuotedLocalColumns(platform: AbstractPlatform): string[] {
    return this.localColumns.map((column) => column.getQuotedName(platform));
  }

  public getForeignColumns(): string[] {
    return this.foreignColumns.map((column) => column.getName());
  }

  public getReferencedColumnNames(): string[] {
    return this.getForeignColumns();
  }

  public getQuotedForeignColumns(platform: AbstractPlatform): string[] {
    return this.foreignColumns.map((column) => column.getQuotedName(platform));
  }

  public onUpdate(): string | null {
    const value = this.options.onUpdate;
    return typeof value === "string" ? value : null;
  }

  public onDelete(): string | null {
    const value = this.options.onDelete;
    return typeof value === "string" ? value : null;
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

  public intersectsIndexColumns(columnNames: string[]): boolean {
    const local = this.getColumns().map(normalize);
    const columns = columnNames.map(normalize);

    return columns.some((column) => local.includes(column));
  }

  public static editor(): ForeignKeyConstraintEditor {
    return new ForeignKeyConstraintEditor();
  }

  public edit(): ForeignKeyConstraintEditor {
    const editor = ForeignKeyConstraint.editor()
      .setName(this.getName())
      .setReferencingColumnNames(...this.getColumns())
      .setReferencedTableName(this.foreignTableName)
      .setReferencedColumnNames(...this.getForeignColumns())
      .setOptions(this.getOptions())
      .setLocalTableName(this.localTableName);

    editor.setOnUpdate(this.onUpdate());
    editor.setOnDelete(this.onDelete());

    return editor;
  }
}

function normalize(identifier: string): string {
  return identifier.replaceAll(/[`"[\]]/g, "").toLowerCase();
}
