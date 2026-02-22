import type { Connection } from "../connection";
import type { AbstractSchemaManager } from "./abstract-schema-manager";

/**
 * Extension point for applications that need custom schema manager instances.
 */
export interface SchemaManagerFactory {
  createSchemaManager(connection: Connection): AbstractSchemaManager;
}
