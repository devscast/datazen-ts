import { Sequence } from "./sequence";
import { Table } from "./table";
import { TableDiff } from "./table-diff";

export interface SchemaDiffOptions {
  createdSchemas?: string[];
  droppedSchemas?: string[];
  createdTables?: Table[];
  alteredTables?: TableDiff[];
  droppedTables?: Table[];
  createdSequences?: Sequence[];
  alteredSequences?: Sequence[];
  droppedSequences?: Sequence[];
}

export class SchemaDiff {
  public readonly createdSchemas: readonly string[];
  public readonly droppedSchemas: readonly string[];
  public readonly createdTables: readonly Table[];
  public readonly alteredTables: readonly TableDiff[];
  public readonly droppedTables: readonly Table[];
  public readonly createdSequences: readonly Sequence[];
  public readonly alteredSequences: readonly Sequence[];
  public readonly droppedSequences: readonly Sequence[];

  constructor(options: SchemaDiffOptions = {}) {
    this.createdSchemas = options.createdSchemas ?? [];
    this.droppedSchemas = options.droppedSchemas ?? [];
    this.createdTables = options.createdTables ?? [];
    this.alteredTables = options.alteredTables ?? [];
    this.droppedTables = options.droppedTables ?? [];
    this.createdSequences = options.createdSequences ?? [];
    this.alteredSequences = options.alteredSequences ?? [];
    this.droppedSequences = options.droppedSequences ?? [];
  }

  public hasChanges(): boolean {
    return (
      this.createdSchemas.length > 0 ||
      this.droppedSchemas.length > 0 ||
      this.createdTables.length > 0 ||
      this.alteredTables.length > 0 ||
      this.droppedTables.length > 0 ||
      this.createdSequences.length > 0 ||
      this.alteredSequences.length > 0 ||
      this.droppedSequences.length > 0
    );
  }
}
