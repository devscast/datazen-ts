import { AbstractSchemaManager } from "./abstract-schema-manager";
import { SchemaConfig } from "./schema-config";

export class MySQLSchemaManager extends AbstractSchemaManager {
  public override createSchemaConfig(): SchemaConfig {
    const config = super.createSchemaConfig();
    const params = this.connection.getParams();
    const charset = params.charset;

    if (typeof charset === "string" && charset.length > 0) {
      config.setDefaultTableOptions({
        ...config.getDefaultTableOptions(),
        charset,
      });
    }

    return config;
  }

  protected getListTableNamesSQL(): string {
    return "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME";
  }

  protected getListViewNamesSQL(): string {
    return "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'VIEW' ORDER BY TABLE_NAME";
  }
}
