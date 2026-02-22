import { UniqueConstraint } from "./unique-constraint";

export class UniqueConstraintEditor {
  private name: string | null = null;
  private columnNames: string[] = [];
  private flags: string[] = [];
  private options: Record<string, unknown> = {};

  public setName(name: string | null): this {
    this.name = name;
    return this;
  }

  public setColumnNames(...columnNames: string[]): this {
    this.columnNames = [...columnNames];
    return this;
  }

  public setFlags(...flags: string[]): this {
    this.flags = [...flags];
    return this;
  }

  public setOptions(options: Record<string, unknown>): this {
    this.options = { ...options };
    return this;
  }

  public create(): UniqueConstraint {
    return new UniqueConstraint(this.name ?? "", this.columnNames, this.flags, this.options);
  }
}
