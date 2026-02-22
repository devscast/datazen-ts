import { AbstractSchemaManager } from "./abstract-schema-manager";

export class SQLiteSchemaManager extends AbstractSchemaManager {
  protected getListTableNamesSQL(): string {
    return "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name";
  }

  protected getListViewNamesSQL(): string {
    return "SELECT name FROM sqlite_master WHERE type = 'view' ORDER BY name";
  }
}
