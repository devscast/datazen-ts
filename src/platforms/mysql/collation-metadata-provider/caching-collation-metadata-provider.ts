import type { CollationMetadataProvider } from "../collation-metadata-provider";

export class CachingCollationMetadataProvider implements CollationMetadataProvider {
  private readonly cache = new Map<string, string | null>();

  public constructor(private readonly provider: CollationMetadataProvider) {}

  public getCollationCharset(collation: string): string | null {
    if (this.cache.has(collation)) {
      return this.cache.get(collation) ?? null;
    }

    const value = this.provider.getCollationCharset(collation);
    this.cache.set(collation, value);
    return value;
  }
}
