export interface CollationMetadataProvider {
  getCollationCharset(collation: string): string | null;
}
