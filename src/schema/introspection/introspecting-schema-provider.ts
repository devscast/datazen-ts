import { AbstractSchemaManager } from "../abstract-schema-manager";
import { Schema } from "../schema";
import { SchemaProvider } from "../schema-provider";

export class IntrospectingSchemaProvider implements SchemaProvider {
  constructor(private readonly schemaManager: AbstractSchemaManager) {}

  public async createSchema(): Promise<Schema> {
    return this.schemaManager.createSchema();
  }
}
