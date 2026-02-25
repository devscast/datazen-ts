import { describe, expect, it, vi } from "vitest";

import { ConnectionCollationMetadataProvider } from "../../../../platforms/mysql/collation-metadata-provider/connection-collation-metadata-provider";

describe("MySQL ConnectionCollationMetadataProvider", () => {
  it("queries information_schema.COLLATIONS and returns a charset", () => {
    const connection = {
      fetchOne: vi.fn().mockReturnValue("utf8mb4"),
      iterateNumeric: vi.fn(),
      iterateColumn: vi.fn(),
    };

    const provider = new ConnectionCollationMetadataProvider(connection);
    expect(provider.getCollationCharset("utf8mb4_general_ci")).toBe("utf8mb4");
    expect(connection.fetchOne).toHaveBeenCalledWith(
      expect.stringContaining("information_schema.COLLATIONS"),
      ["utf8mb4_general_ci"],
    );
  });

  it("returns null when the collation is not found", () => {
    const provider = new ConnectionCollationMetadataProvider({
      fetchOne: () => false,
      iterateNumeric: () => [],
      iterateColumn: () => [],
    });

    expect(provider.getCollationCharset("missing")).toBeNull();
  });
});
