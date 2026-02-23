import { AbstractMySQLPlatform } from "./abstract-mysql-platform";
import type { KeywordList } from "./keywords/keyword-list";
import { MariaDBKeywords } from "./keywords/mariadb-keywords";

export class MariaDBPlatform extends AbstractMySQLPlatform {
  protected override createReservedKeywordsList(): KeywordList {
    return new MariaDBKeywords();
  }
}
