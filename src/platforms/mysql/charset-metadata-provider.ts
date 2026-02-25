export interface CharsetMetadataProvider {
  getDefaultCharsetCollation(charset: string): string | null;
}
