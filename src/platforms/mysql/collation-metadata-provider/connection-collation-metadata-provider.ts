import type { SyncQueryConnection } from "../../_internal/sync-query-connection";
import type { CollationMetadataProvider } from "../collation-metadata-provider";

export class ConnectionCollationMetadataProvider implements CollationMetadataProvider {
  public constructor(private readonly connection: SyncQueryConnection) {}

  public getCollationCharset(collation: string): string | null {
    const charset = this.connection.fetchOne<string>(
      `SELECT CHARACTER_SET_NAME
FROM information_schema.COLLATIONS
WHERE COLLATION_NAME = ?;`,
      [collation],
    );

    return charset === false ? null : charset;
  }
}
