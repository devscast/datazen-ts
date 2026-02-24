import type { AbstractPlatform } from "../platforms/abstract-platform";
import { AbstractAsset } from "./abstract-asset";
import { Identifier } from "./identifier";
import { IndexType } from "./index/index-type";
import { IndexedColumn } from "./index/indexed-column";
import { IndexEditor } from "./index-editor";
import type { UnqualifiedNameParser } from "./name/parser/unqualified-name-parser";
import { Parsers } from "./name/parsers";

export class Index extends AbstractAsset {
  private readonly columns: Identifier[] = [];
  private readonly unique: boolean;
  private readonly primary: boolean;
  private readonly flags = new Set<string>();

  constructor(
    name: string | null,
    columns: string[],
    isUnique = false,
    isPrimary = false,
    flags: string[] = [],
    private readonly options: Record<string, unknown> = {},
  ) {
    super(name ?? "");

    this.unique = isUnique || isPrimary;
    this.primary = isPrimary;

    for (const column of columns) {
      this.columns.push(new Identifier(column));
    }

    for (const flag of flags) {
      this.flags.add(flag.toLowerCase());
    }
  }

  public getColumns(): string[] {
    return this.columns.map((column) => column.getName());
  }

  public getQuotedColumns(platform: AbstractPlatform): string[] {
    const lengths = Array.isArray(this.options.lengths) ? this.options.lengths : [];

    return this.columns.map((column, index) => {
      const length = lengths[index];
      const quoted = column.getQuotedName(platform);

      if (typeof length === "number") {
        return `${quoted}(${length})`;
      }

      return quoted;
    });
  }

  public getUnquotedColumns(): string[] {
    return this.getColumns().map((column) => column.replaceAll(/[`"[\]]/g, ""));
  }

  public getIndexedColumns(): IndexedColumn[] {
    const lengths = Array.isArray(this.options.lengths) ? this.options.lengths : [];

    return this.columns.map((column, index) => {
      const rawLength = lengths[index];
      const length = typeof rawLength === "number" ? rawLength : null;
      return new IndexedColumn(column.getName(), length);
    });
  }

  public getType(): IndexType {
    if (this.unique) {
      return IndexType.UNIQUE;
    }

    if (this.hasFlag("fulltext")) {
      return IndexType.FULLTEXT;
    }

    if (this.hasFlag("spatial")) {
      return IndexType.SPATIAL;
    }

    return IndexType.REGULAR;
  }

  public isClustered(): boolean {
    return this.hasFlag("clustered");
  }

  public getPredicate(): string | null {
    const predicate = this.options.where;
    return typeof predicate === "string" && predicate.length > 0 ? predicate : null;
  }

  public isSimpleIndex(): boolean {
    return !this.primary && !this.unique;
  }

  public isUnique(): boolean {
    return this.unique;
  }

  public isPrimary(): boolean {
    return this.primary;
  }

  public hasColumnAtPosition(name: string, pos = 0): boolean {
    const normalized = normalizeIdentifier(name);
    return normalizeIdentifier(this.getColumns()[pos] ?? "") === normalized;
  }

  public spansColumns(columnNames: string[]): boolean {
    const ownColumns = this.getColumns();
    if (ownColumns.length !== columnNames.length) {
      return false;
    }

    return ownColumns.every((column, index) => {
      const other = columnNames[index];
      if (other === undefined) {
        return false;
      }

      return normalizeIdentifier(column) === normalizeIdentifier(other);
    });
  }

  public isFulfilledBy(index: Index): boolean {
    if (this.columns.length !== index.columns.length) {
      return false;
    }

    if (this.isUnique() && !index.isUnique()) {
      return false;
    }

    if (this.isPrimary() !== index.isPrimary()) {
      return false;
    }

    return this.spansColumns(index.getColumns());
  }

  public addFlag(flag: string): this {
    this.flags.add(flag.toLowerCase());
    return this;
  }

  public hasFlag(flag: string): boolean {
    return this.flags.has(flag.toLowerCase());
  }

  public getFlags(): string[] {
    return [...this.flags];
  }

  public removeFlag(flag: string): void {
    this.flags.delete(flag.toLowerCase());
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

  public overrules(other: Index): boolean {
    if (other.isPrimary()) {
      return false;
    }

    if (this.isSimpleIndex() && other.isUnique()) {
      return false;
    }

    return (
      this.spansColumns(other.getColumns()) &&
      (this.isPrimary() || this.isUnique()) &&
      this.getPredicate() === other.getPredicate()
    );
  }

  public static editor(): IndexEditor {
    return new IndexEditor();
  }

  public edit(): IndexEditor {
    return Index.editor()
      .setName(this.getName())
      .setColumns(...this.getColumns())
      .setIsUnique(this.unique)
      .setIsPrimary(this.primary)
      .setFlags(...this.getFlags())
      .setOptions(this.getOptions());
  }

  protected getNameParser(): UnqualifiedNameParser {
    return Parsers.getUnqualifiedNameParser();
  }

  protected _addColumn(column: string): void {
    this.columns.push(new Identifier(column));
  }
}

function normalizeIdentifier(identifier: string): string {
  return identifier.replaceAll(/[`"[\]]/g, "").toLowerCase();
}
