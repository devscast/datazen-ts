import { Schema } from "./schema";

export interface SchemaProvider {
  createSchema(): Promise<Schema>;
}
