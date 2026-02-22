import { AbstractSchemaManager } from "./abstract-schema-manager";

export class PostgreSQLSchemaManager extends AbstractSchemaManager {
  protected getListTableNamesSQL(): string {
    return "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = current_schema() ORDER BY tablename";
  }

  protected getListViewNamesSQL(): string {
    return "SELECT viewname FROM pg_catalog.pg_views WHERE schemaname = current_schema() ORDER BY viewname";
  }
}
