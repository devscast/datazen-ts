import { describe, expect, it, vi } from "vitest";

import { CachingCharsetMetadataProvider } from "../../../../platforms/mysql/charset-metadata-provider/caching-charset-metadata-provider";

describe("MySQL CachingCharsetMetadataProvider", () => {
  it.each([
    ["utf8mb4", "utf8mb4_general_ci"],
    ["utf8mb5", null],
  ])("caches default collation lookups for %s", (charset, collation) => {
    const underlying = {
      getDefaultCharsetCollation: vi.fn().mockReturnValue(collation),
    };

    const provider = new CachingCharsetMetadataProvider(underlying);

    expect(provider.getDefaultCharsetCollation(charset)).toBe(collation);
    expect(provider.getDefaultCharsetCollation(charset)).toBe(collation);
    expect(underlying.getDefaultCharsetCollation).toHaveBeenCalledTimes(1);
    expect(underlying.getDefaultCharsetCollation).toHaveBeenCalledWith(charset);
  });
});
