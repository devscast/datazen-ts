import { describe, expect, it, vi } from "vitest";

import { CachingCollationMetadataProvider } from "../../../../platforms/mysql/collation-metadata-provider/caching-collation-metadata-provider";

describe("MySQL CachingCollationMetadataProvider (Doctrine parity)", () => {
  it.each([
    ["utf8mb4_unicode_ci", "utf8mb4"],
    ["utf8mb5_unicode_ci", null],
  ])("caches collation charset lookups for %s", (collation, charset) => {
    const underlying = {
      getCollationCharset: vi.fn().mockReturnValue(charset),
    };

    const cachingProvider = new CachingCollationMetadataProvider(underlying);

    expect(cachingProvider.getCollationCharset(collation)).toBe(charset);
    expect(cachingProvider.getCollationCharset(collation)).toBe(charset);
    expect(underlying.getCollationCharset).toHaveBeenCalledTimes(1);
    expect(underlying.getCollationCharset).toHaveBeenCalledWith(collation);
  });
});
