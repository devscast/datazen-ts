import { AbstractSchemaManager } from "./abstract-schema-manager";

export class DB2SchemaManager extends AbstractSchemaManager {
  protected getListTableNamesSQL(): string {
    return "SELECT TABNAME FROM SYSCAT.TABLES WHERE TYPE = 'T' AND TABSCHEMA = CURRENT SCHEMA ORDER BY TABNAME";
  }

  protected getListViewNamesSQL(): string {
    return "SELECT VIEWNAME FROM SYSCAT.VIEWS WHERE VIEWSCHEMA = CURRENT SCHEMA ORDER BY VIEWNAME";
  }
}
