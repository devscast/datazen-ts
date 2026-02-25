import { describe, expect, it } from "vitest";

import { SQLitePlatform } from "../../platforms/sqlite-platform";
import { assertCommonPlatformSurface } from "./_helpers/platform-parity-scaffold";

describe("SQLitePlatform parity", () => {
  it("exposes SQLite-specific SQL helpers", () => {
    const platform = new SQLitePlatform();

    assertCommonPlatformSurface(platform);
    expect(platform.getCurrentDateSQL()).toBe("DATE('now')");
    expect(platform.getCurrentTimeSQL()).toBe("TIME('now')");
  });
});
