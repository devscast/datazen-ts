import type { AbstractMySQLPlatform } from "../platforms/abstract-mysql-platform";
import { Comparator as MySQLComparator } from "../platforms/mysql/comparator";
import { DefaultTableOptions } from "../platforms/mysql/default-table-options";
import { AbstractSchemaManager } from "./abstract-schema-manager";
import { Comparator } from "./comparator";
import { ComparatorConfig } from "./comparator-config";
import { SchemaConfig } from "./schema-config";

export class MySQLSchemaManager extends AbstractSchemaManager {
  private readonly defaultCollationByCharset = new Map<string, string>();
  private readonly charsetByCollation = new Map<string, string>();
  private comparatorMetadataLoaded = false;
  private comparatorMetadataLoadPromise: Promise<void> | null = null;

  public override async initialize(): Promise<void> {
    await this.ensureComparatorMetadataLoaded();
  }

  public override createComparator(config: ComparatorConfig = new ComparatorConfig()): Comparator {
    const params = this.connection.getParams();
    const defaultCharset = typeof params.charset === "string" ? params.charset : "";
    const defaultCollation =
      (typeof (params as { collation?: unknown }).collation === "string"
        ? ((params as { collation?: string }).collation ?? "")
        : (this.defaultCollationByCharset.get(defaultCharset) ?? "")) || "";

    return new MySQLComparator(
      this.platform as AbstractMySQLPlatform,
      {
        getDefaultCharsetCollation: (charset) =>
          this.defaultCollationByCharset.get(charset) ?? null,
      },
      {
        getCollationCharset: (collation) => this.charsetByCollation.get(collation) ?? null,
      },
      new DefaultTableOptions(defaultCharset, defaultCollation),
      config,
    );
  }

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

  private async ensureComparatorMetadataLoaded(): Promise<void> {
    if (this.comparatorMetadataLoaded) {
      return;
    }

    if (this.comparatorMetadataLoadPromise !== null) {
      await this.comparatorMetadataLoadPromise;
      return;
    }

    this.comparatorMetadataLoadPromise = (async () => {
      const [charsetRows, collationRows] = await Promise.all([
        this.connection.fetchAllAssociative<Record<string, unknown>>(
          `SELECT CHARACTER_SET_NAME, DEFAULT_COLLATE_NAME
FROM information_schema.CHARACTER_SETS`,
        ),
        this.connection.fetchAllAssociative<Record<string, unknown>>(
          `SELECT COLLATION_NAME, CHARACTER_SET_NAME
FROM information_schema.COLLATIONS`,
        ),
      ]);

      for (const row of charsetRows) {
        const charset = readString(row, "CHARACTER_SET_NAME");
        const collation = readString(row, "DEFAULT_COLLATE_NAME");
        if (charset === null || collation === null) {
          continue;
        }

        this.defaultCollationByCharset.set(charset, collation);
      }

      for (const row of collationRows) {
        const collation = readString(row, "COLLATION_NAME");
        const charset = readString(row, "CHARACTER_SET_NAME");
        if (collation === null || charset === null) {
          continue;
        }

        this.charsetByCollation.set(collation, charset);
      }

      this.comparatorMetadataLoaded = true;
    })();

    try {
      await this.comparatorMetadataLoadPromise;
    } finally {
      this.comparatorMetadataLoadPromise = null;
    }
  }
}

function readString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}
