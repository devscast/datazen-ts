import type { SyncQueryConnection } from "../../_internal/sync-query-connection";
import type { CharsetMetadataProvider } from "../charset-metadata-provider";

export class ConnectionCharsetMetadataProvider implements CharsetMetadataProvider {
  public constructor(private readonly connection: SyncQueryConnection) {}

  public getDefaultCharsetCollation(charset: string): string | null {
    const collation = this.connection.fetchOne<string>(
      `SELECT DEFAULT_COLLATE_NAME
FROM information_schema.CHARACTER_SETS
WHERE CHARACTER_SET_NAME = ?;`,
      [charset],
    );

    return collation === false ? null : collation;
  }
}
