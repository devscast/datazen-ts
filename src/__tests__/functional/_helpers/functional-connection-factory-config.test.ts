import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  type FunctionalTarget,
  resolveFunctionalConfigProfile,
} from "./functional-connection-factory";

describe("Functional connection factory JSON config", () => {
  const previousConfigFile = process.env.DATAZEN_FUNCTIONAL_CONFIG_FILE;
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      try {
        rmSync(dir, { force: true, recursive: true });
      } catch {
        // best effort test cleanup
      }
    }

    if (previousConfigFile === undefined) {
      delete process.env.DATAZEN_FUNCTIONAL_CONFIG_FILE;
    } else {
      process.env.DATAZEN_FUNCTIONAL_CONFIG_FILE = previousConfigFile;
    }
  });

  it("reads a single-profile JSON config", () => {
    const configFile = writeTempConfig(tempDirs, {
      connection: {
        database: "datazen",
        host: "127.0.0.1",
        password: "datazen",
        port: 3306,
        user: "datazen",
      },
      platform: "mysql",
      serverVersion: "8.4.0",
    });

    process.env.DATAZEN_FUNCTIONAL_CONFIG_FILE = configFile;

    const profile = resolveFunctionalConfigProfile(mysqlTarget());

    expect(profile).not.toBeNull();
    expect(profile?.serverVersion).toBe("8.4.0");
    expect(profile?.connection?.port).toBe(3306);
    expect(profile?.connection?.host).toBe("127.0.0.1");
  });

  it("reads privilegedConnection values from JSON config", () => {
    const configFile = writeTempConfig(tempDirs, {
      connection: {
        host: "127.0.0.1",
        port: 3306,
        user: "datazen",
      },
      platform: "mysql",
      privilegedConnection: {
        host: "127.0.0.1",
        password: "root",
        user: "root",
      },
    });

    process.env.DATAZEN_FUNCTIONAL_CONFIG_FILE = configFile;

    const profile = resolveFunctionalConfigProfile(mysqlTarget());

    expect(profile?.privilegedConnection?.user).toBe("root");
    expect(profile?.privilegedConnection?.password).toBe("root");
    expect(profile?.privilegedConnection?.host).toBe("127.0.0.1");
  });

  it("selects the matching target profile from a multi-target JSON config", () => {
    const configFile = writeTempConfig(tempDirs, {
      targets: {
        mysql: {
          connection: { host: "mysql.local", port: 3306 },
          platform: "mysql",
        },
        postgresql: {
          connection: { host: "pg.local", port: 5432 },
          platform: "postgresql",
        },
      },
    });

    process.env.DATAZEN_FUNCTIONAL_CONFIG_FILE = configFile;

    const profile = resolveFunctionalConfigProfile({
      driver: "pg",
      platform: "postgresql",
    });

    expect(profile?.connection?.host).toBe("pg.local");
    expect(profile?.connection?.port).toBe(5432);
  });

  it("throws when the config file platform does not match the selected target", () => {
    const configFile = writeTempConfig(tempDirs, {
      connection: { file: ":memory:" },
      platform: "sqlite3",
    });

    process.env.DATAZEN_FUNCTIONAL_CONFIG_FILE = configFile;

    expect(() => resolveFunctionalConfigProfile(mysqlTarget())).toThrow(
      /targets platform "sqlite3".*resolved to "mysql"/i,
    );
  });
});

function mysqlTarget(): FunctionalTarget {
  return {
    driver: "mysql2",
    platform: "mysql",
  };
}

function writeTempConfig(tempDirs: string[], payload: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "datazen-functional-config-"));
  tempDirs.push(dir);
  const filePath = join(dir, "functional.json");
  writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
  return filePath;
}
