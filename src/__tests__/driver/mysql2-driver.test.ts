import { describe, expect, it } from "vitest";

import { ParameterBindingStyle } from "../../driver";
import { MySQL2Driver } from "../../driver/mysql2/driver";
import { DbalException } from "../../exception/index";
import { InvalidPlatformVersion } from "../../platforms/exception/invalid-platform-version";
import { MariaDB1010Platform } from "../../platforms/mariadb1010-platform";
import { MariaDB1052Platform } from "../../platforms/mariadb1052-platform";
import { MariaDB110700Platform } from "../../platforms/mariadb110700-platform";
import { MySQLPlatform } from "../../platforms/mysql-platform";
import { MySQL80Platform } from "../../platforms/mysql80-platform";
import { MySQL84Platform } from "../../platforms/mysql84-platform";
import { StaticServerVersionProvider } from "../../static-server-version-provider";

describe("MySQL2Driver", () => {
  it("exposes expected metadata", () => {
    const driver = new MySQL2Driver();

    expect(driver.name).toBe("mysql2");
    expect(driver.bindingStyle).toBe(ParameterBindingStyle.POSITIONAL);
  });

  it("throws when no client object is provided", async () => {
    const driver = new MySQL2Driver();

    await expect(driver.connect({})).rejects.toThrow(DbalException);
  });

  it("prefers pool over connection/client in params", async () => {
    const driver = new MySQL2Driver();
    const pool = { query: async () => [] };
    const connection = { query: async () => [] };
    const client = { query: async () => [] };

    const driverConnection = await driver.connect({
      client,
      connection,
      pool,
    });

    expect(driverConnection.getNativeConnection()).toBe(pool);
  });

  it("uses connection when pool is not provided", async () => {
    const driver = new MySQL2Driver();
    const connection = { query: async () => [] };

    const driverConnection = await driver.connect({
      connection,
    });

    expect(driverConnection.getNativeConnection()).toBe(connection);
  });

  it("owns client when ownsPool is set", async () => {
    const driver = new MySQL2Driver();
    const calls = { end: 0 };
    const pool = {
      end: async () => {
        calls.end += 1;
      },
      query: async () => [],
    };

    const driverConnection = await driver.connect({
      ownsPool: true,
      pool,
    });

    await driverConnection.close();
    expect(calls.end).toBe(1);
  });

  it("does not own client by default", async () => {
    const driver = new MySQL2Driver();
    const calls = { end: 0 };
    const pool = {
      end: async () => {
        calls.end += 1;
      },
      query: async () => [],
    };

    const driverConnection = await driver.connect({
      pool,
    });

    await driverConnection.close();
    expect(calls.end).toBe(0);
  });

  it("returns a stable exception converter instance", () => {
    const driver = new MySQL2Driver();

    expect(driver.getExceptionConverter()).toBe(driver.getExceptionConverter());
  });

  it("resolves MySQL platform variants from static versions", () => {
    const driver = new MySQL2Driver();

    expect(driver.getDatabasePlatform(new StaticServerVersionProvider("8.0.36"))).toBeInstanceOf(
      MySQL80Platform,
    );
    expect(driver.getDatabasePlatform(new StaticServerVersionProvider("8.4.2"))).toBeInstanceOf(
      MySQL84Platform,
    );
    expect(driver.getDatabasePlatform(new StaticServerVersionProvider("5.7.44"))).toBeInstanceOf(
      MySQLPlatform,
    );
  });

  it("resolves MariaDB platform variants from static versions", () => {
    const driver = new MySQL2Driver();

    expect(
      driver.getDatabasePlatform(new StaticServerVersionProvider("10.10.2-MariaDB-1:10.10.2")),
    ).toBeInstanceOf(MariaDB1010Platform);
    expect(
      driver.getDatabasePlatform(new StaticServerVersionProvider("11.7.1-MariaDB-ubu2404")),
    ).toBeInstanceOf(MariaDB110700Platform);
    expect(
      driver.getDatabasePlatform(new StaticServerVersionProvider("5.5.5-MariaDB-10.5.21")),
    ).toBeInstanceOf(MariaDB1052Platform);
  });

  it("throws InvalidPlatformVersion for malformed MariaDB versions", () => {
    const driver = new MySQL2Driver();

    expect(() =>
      driver.getDatabasePlatform(new StaticServerVersionProvider("mariadb-not-a-version")),
    ).toThrow(InvalidPlatformVersion);
  });

  it("throws InvalidPlatformVersion for malformed MySQL versions", () => {
    const driver = new MySQL2Driver();

    expect(() =>
      driver.getDatabasePlatform(new StaticServerVersionProvider("totally-invalid-version")),
    ).toThrow(InvalidPlatformVersion);
  });
});
