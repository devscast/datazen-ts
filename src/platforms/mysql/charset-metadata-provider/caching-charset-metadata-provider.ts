import type { CharsetMetadataProvider } from "../charset-metadata-provider";

export class CachingCharsetMetadataProvider implements CharsetMetadataProvider {
  private readonly cache = new Map<string, string | null>();

  public constructor(private readonly provider: CharsetMetadataProvider) {}

  public getDefaultCharsetCollation(charset: string): string | null {
    if (this.cache.has(charset)) {
      return this.cache.get(charset) ?? null;
    }

    const value = this.provider.getDefaultCharsetCollation(charset);
    this.cache.set(charset, value);
    return value;
  }
}
