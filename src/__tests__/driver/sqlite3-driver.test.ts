import { describe, expect, it } from "vitest";

import { ParameterBindingStyle } from "../../driver";
import { SQLite3Driver } from "../../driver/sqlite3/driver";
import { DbalException } from "../../exception/index";
import { SQLitePlatform } from "../../platforms/sqlite-platform";
import { StaticServerVersionProvider } from "../../static-server-version-provider";

describe("SQLite3Driver", () => {
  it("exposes expected metadata", () => {
    const driver = new SQLite3Driver();

    expect(driver.name).toBe("sqlite3");
    expect(driver.bindingStyle).toBe(ParameterBindingStyle.POSITIONAL);
  });

  it("throws when no database object is provided", async () => {
    const driver = new SQLite3Driver();

    await expect(driver.connect({})).rejects.toThrow(DbalException);
  });

  it("prefers database over connection/client", async () => {
    const driver = new SQLite3Driver();
    const database = { all: () => undefined, run: () => undefined };
    const connection = { all: () => undefined, run: () => undefined };
    const client = { all: () => undefined, run: () => undefined };

    const driverConnection = await driver.connect({
      client,
      connection,
      database,
    });

    expect(driverConnection.getNativeConnection()).toBe(database);
  });

  it("closes owned databases when configured", async () => {
    const calls = { close: 0 };
    const database = {
      all: (_sql: string, _params: unknown[], cb: (e: Error | null, rows?: unknown[]) => void) =>
        cb(null, []),
      close: (cb: (e: Error | null) => void) => {
        calls.close += 1;
        cb(null);
      },
      run: (
        _sql: string,
        _params: unknown[],
        cb?: (this: { changes: number; lastID: number }, e: Error | null) => void,
      ) => cb?.call({ changes: 0, lastID: 0 }, null),
    };

    const connection = await new SQLite3Driver().connect({ client: database, ownsClient: true });
    await connection.close();
    expect(calls.close).toBe(1);
  });

  it("returns a stable exception converter instance", () => {
    const driver = new SQLite3Driver();
    expect(driver.getExceptionConverter()).toBe(driver.getExceptionConverter());
  });

  it("returns the SQLite platform", () => {
    const platform = new SQLite3Driver().getDatabasePlatform(
      new StaticServerVersionProvider("3.45.1"),
    );
    expect(platform).toBeInstanceOf(SQLitePlatform);
  });
});
