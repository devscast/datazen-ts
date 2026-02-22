import { AbstractSchemaManager } from "./abstract-schema-manager";

export class OracleSchemaManager extends AbstractSchemaManager {
  protected getListTableNamesSQL(): string {
    return "SELECT TABLE_NAME FROM USER_TABLES ORDER BY TABLE_NAME";
  }

  protected getListViewNamesSQL(): string {
    return "SELECT VIEW_NAME FROM USER_VIEWS ORDER BY VIEW_NAME";
  }
}
