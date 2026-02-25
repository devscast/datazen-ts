import { describe, expect, it, vi } from "vitest";

import { ConnectionCharsetMetadataProvider } from "../../../../platforms/mysql/charset-metadata-provider/connection-charset-metadata-provider";

describe("MySQL ConnectionCharsetMetadataProvider", () => {
  it("queries information_schema.CHARACTER_SETS and returns a collation", () => {
    const connection = {
      fetchOne: vi.fn().mockReturnValue("utf8mb4_general_ci"),
      iterateNumeric: vi.fn(),
      iterateColumn: vi.fn(),
    };

    const provider = new ConnectionCharsetMetadataProvider(connection);
    expect(provider.getDefaultCharsetCollation("utf8mb4")).toBe("utf8mb4_general_ci");
    expect(connection.fetchOne).toHaveBeenCalledWith(
      expect.stringContaining("information_schema.CHARACTER_SETS"),
      ["utf8mb4"],
    );
  });

  it("returns null when the charset is not found", () => {
    const provider = new ConnectionCharsetMetadataProvider({
      fetchOne: () => false,
      iterateNumeric: () => [],
      iterateColumn: () => [],
    });

    expect(provider.getDefaultCharsetCollation("missing")).toBeNull();
  });
});
