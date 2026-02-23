import { describe, expect, it } from "vitest";

import { ParameterBindingStyle } from "../../driver";
import { PgDriver } from "../../driver/pg/driver";
import { DbalException } from "../../exception/index";
import { InvalidPlatformVersion } from "../../platforms/exception/invalid-platform-version";
import { PostgreSQLPlatform } from "../../platforms/postgre-sql-platform";
import { PostgreSQL120Platform } from "../../platforms/postgre-sql120-platform";
import { StaticServerVersionProvider } from "../../static-server-version-provider";

describe("PgDriver", () => {
  it("exposes expected metadata", () => {
    const driver = new PgDriver();

    expect(driver.name).toBe("pg");
    expect(driver.bindingStyle).toBe(ParameterBindingStyle.POSITIONAL);
  });

  it("throws when no client object is provided", async () => {
    const driver = new PgDriver();

    await expect(driver.connect({})).rejects.toThrow(DbalException);
  });

  it("prefers pool over connection/client in params", async () => {
    const driver = new PgDriver();
    const pool = { query: async () => ({ rows: [] }) };
    const connection = { query: async () => ({ rows: [] }) };
    const client = { query: async () => ({ rows: [] }) };

    const driverConnection = await driver.connect({
      client,
      connection,
      pool,
    });

    expect(driverConnection.getNativeConnection()).toBe(pool);
  });

  it("closes owned clients when configured", async () => {
    const calls = { end: 0 };
    const pool = {
      end: async () => {
        calls.end += 1;
      },
      query: async () => ({ rows: [] }),
    };

    const driverConnection = await new PgDriver().connect({
      ownsPool: true,
      pool,
    });

    await driverConnection.close();
    expect(calls.end).toBe(1);
  });

  it("returns a stable exception converter instance", () => {
    const driver = new PgDriver();
    expect(driver.getExceptionConverter()).toBe(driver.getExceptionConverter());
  });

  it("returns PostgreSQL platform variants from server version", () => {
    const driver = new PgDriver();
    const platform = driver.getDatabasePlatform(new StaticServerVersionProvider("11.22"));
    const platform120 = driver.getDatabasePlatform(new StaticServerVersionProvider("16.2"));

    expect(platform).toBeInstanceOf(PostgreSQLPlatform);
    expect(platform120).toBeInstanceOf(PostgreSQL120Platform);
  });

  it("throws InvalidPlatformVersion for malformed PostgreSQL versions", () => {
    const driver = new PgDriver();

    expect(() =>
      driver.getDatabasePlatform(new StaticServerVersionProvider("not-a-postgres-version")),
    ).toThrow(InvalidPlatformVersion);
  });
});
