import type { Connection } from "../connection";
import { AbstractMySQLPlatform } from "./abstract-mysql-platform";
import type { KeywordList } from "./keywords/keyword-list";
import { MariaDBKeywords } from "./keywords/mariadb-keywords";
import { MySQLMetadataProvider } from "./mysql/mysql-metadata-provider";

export class MariaDBPlatform extends AbstractMySQLPlatform {
  public override createMetadataProvider(connection: Connection): MySQLMetadataProvider {
    return new MySQLMetadataProvider(connection, this, connection.getDatabase() ?? "");
  }

  protected override createReservedKeywordsList(): KeywordList {
    return new MariaDBKeywords();
  }
}
