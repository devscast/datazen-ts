import { readFileSync } from "node:fs";

import { Configuration } from "../../../configuration";
import { Connection } from "../../../connection";
import { DriverManager } from "../../../driver-manager";

export type FunctionalDriver = "mssql" | "mysql2" | "pg" | "sqlite3";
export type FunctionalPlatformTarget = "mariadb" | "mysql" | "postgresql" | "sqlite3" | "sqlserver";

export type FunctionalTarget = {
  driver: FunctionalDriver;
  platform: FunctionalPlatformTarget;
};

type FunctionalConnectionBundle = {
  connection: Connection;
  target: FunctionalTarget;
};

type FunctionalConfigProfile = {
  connection?: Record<string, unknown>;
  privilegedConnection?: Record<string, unknown>;
  driver?: string;
  platform?: string;
  serverVersion?: string;
};

type FunctionalConfigFile = FunctionalConfigProfile & {
  targets?: Record<string, FunctionalConfigProfile>;
};

const PLATFORM_TO_DRIVER: Record<string, FunctionalTarget> = {
  mariadb: { driver: "mysql2", platform: "mariadb" },
  mssql: { driver: "mssql", platform: "sqlserver" },
  mysql: { driver: "mysql2", platform: "mysql" },
  mysql2: { driver: "mysql2", platform: "mysql" },
  pg: { driver: "pg", platform: "postgresql" },
  pgsql: { driver: "pg", platform: "postgresql" },
  postgresql: { driver: "pg", platform: "postgresql" },
  sqlite: { driver: "sqlite3", platform: "sqlite3" },
  sqlite3: { driver: "sqlite3", platform: "sqlite3" },
  sqlserver: { driver: "mssql", platform: "sqlserver" },
};

export function resolveFunctionalTarget(): FunctionalTarget {
  const requested =
    process.env.DATAZEN_FUNCTIONAL_PLATFORM ?? process.env.DATAZEN_FUNCTIONAL_DRIVER ?? "sqlite3";
  const normalized = requested.trim().toLowerCase();
  const target = PLATFORM_TO_DRIVER[normalized];

  if (target === undefined) {
    throw new Error(
      `Unsupported DATAZEN_FUNCTIONAL_PLATFORM/DATAZEN_FUNCTIONAL_DRIVER "${requested}". ` +
        `Supported values: ${Object.keys(PLATFORM_TO_DRIVER).sort().join(", ")}`,
    );
  }

  return target;
}

export async function createFunctionalConnection(): Promise<Connection> {
  const { connection } = await createFunctionalConnectionBundle();
  return connection;
}

export async function createFunctionalConnectionWithConfiguration(
  configuration: Configuration,
): Promise<Connection> {
  const target = resolveFunctionalTarget();

  switch (target.driver) {
    case "sqlite3":
      return createSQLite3Connection("default", configuration);
    case "mysql2":
      return createMySQL2Connection(target, "default", configuration);
    case "pg":
      return createPgConnection(target, "default", configuration);
    case "mssql":
      return createMSSQLConnection(target, "default", configuration);
  }
}

export async function createPrivilegedFunctionalConnection(): Promise<Connection> {
  const target = resolveFunctionalTarget();

  switch (target.driver) {
    case "sqlite3":
      return createSQLite3Connection("privileged");
    case "mysql2":
      return createMySQL2Connection(target, "privileged");
    case "pg":
      return createPgConnection(target, "privileged");
    case "mssql":
      return createMSSQLConnection(target, "privileged");
  }
}

export async function createFunctionalConnectionBundle(): Promise<FunctionalConnectionBundle> {
  const target = resolveFunctionalTarget();

  switch (target.driver) {
    case "sqlite3":
      return {
        connection: await createSQLite3Connection(),
        target,
      };
    case "mysql2":
      return {
        connection: await createMySQL2Connection(target),
        target,
      };
    case "pg":
      return {
        connection: await createPgConnection(target),
        target,
      };
    case "mssql":
      return {
        connection: await createMSSQLConnection(target),
        target,
      };
  }
}

type FunctionalConnectionRole = "default" | "privileged";

async function createSQLite3Connection(
  role: FunctionalConnectionRole = "default",
  configuration?: Configuration,
): Promise<Connection> {
  const sqliteModule = await importOptional("sqlite3", { driver: "sqlite3", platform: "sqlite3" });
  const sqlite3 = (sqliteModule.default ?? sqliteModule) as {
    Database: new (
      filename: string,
      callback: (error: Error | null) => void,
    ) => { close?: (callback: (error: Error | null) => void) => void };
  };
  const sqliteFile = readEnv("sqlite3", "FILE", ":memory:", role);
  const client = await new Promise<object>((resolve, reject) => {
    const db = new sqlite3.Database(sqliteFile, (error) => {
      if (error !== null) {
        reject(error);
        return;
      }

      resolve(db as object);
    });
  });

  return DriverManager.getConnection(
    {
      client: client as Record<string, unknown>,
      driver: "sqlite3",
      ownsClient: true,
      ...readCommonConnectionOverrides({ driver: "sqlite3", platform: "sqlite3" }, role),
    },
    configuration,
  );
}

async function createMySQL2Connection(
  target: FunctionalTarget,
  role: FunctionalConnectionRole = "default",
  configuration?: Configuration,
): Promise<Connection> {
  const mysql2 = await importOptional("mysql2/promise", target);
  const mysqlModule = mysql2.default ?? mysql2;

  if (typeof mysqlModule.createPool !== "function") {
    throw new Error('The "mysql2/promise" module does not expose createPool().');
  }

  const pool = mysqlModule.createPool({
    database: readEnv(target.platform, "DATABASE", "datazen", role),
    host: readEnv(target.platform, "HOST", "127.0.0.1", role),
    password: readEnv(
      target.platform,
      "PASSWORD",
      role === "privileged" ? "root" : "datazen",
      role,
    ),
    port: readNumberEnv(target.platform, "PORT", target.platform === "mariadb" ? 3307 : 3306, role),
    user: readEnv(target.platform, "USER", role === "privileged" ? "root" : "datazen", role),
  });

  return DriverManager.getConnection(
    {
      driver: "mysql2",
      ownsPool: true,
      pool,
      ...readCommonConnectionOverrides(target, role),
    },
    configuration,
  );
}

async function createPgConnection(
  target: FunctionalTarget,
  role: FunctionalConnectionRole = "default",
  configuration?: Configuration,
): Promise<Connection> {
  const pg = await importOptional("pg", target);
  const PgPool = (pg.Pool ?? pg.default?.Pool) as (new (...args: unknown[]) => unknown) | undefined;

  if (PgPool === undefined) {
    throw new Error('The "pg" module does not expose Pool.');
  }

  const pool = new PgPool({
    database: readEnv(target.platform, "DATABASE", "datazen", role),
    host: readEnv(target.platform, "HOST", "127.0.0.1", role),
    password: readEnv(target.platform, "PASSWORD", "datazen", role),
    port: readNumberEnv(target.platform, "PORT", 5432, role),
    user: readEnv(target.platform, "USER", "datazen", role),
  });

  return DriverManager.getConnection(
    {
      driver: "pg",
      ownsPool: true,
      pool: pool as Record<string, unknown>,
      ...readCommonConnectionOverrides(target, role),
    },
    configuration,
  );
}

async function createMSSQLConnection(
  target: FunctionalTarget,
  role: FunctionalConnectionRole = "default",
  configuration?: Configuration,
): Promise<Connection> {
  const mssql = await importOptional("mssql", target);
  const module = (mssql.default ?? mssql) as Record<string, unknown>;
  const ConnectionPool = module.ConnectionPool as
    | (new (
        config: Record<string, unknown>,
      ) => { connect?: () => Promise<unknown> })
    | undefined;

  if (ConnectionPool === undefined) {
    throw new Error('The "mssql" module does not expose ConnectionPool.');
  }

  const pool = new ConnectionPool({
    database: readEnv(target.platform, "DATABASE", "tempdb", role),
    options: {
      encrypt: readBooleanEnv(target.platform, "ENCRYPT", false, role),
      trustServerCertificate: readBooleanEnv(
        target.platform,
        "TRUST_SERVER_CERTIFICATE",
        true,
        role,
      ),
    },
    password: readEnv(target.platform, "PASSWORD", "Datazen123!", role),
    port: readNumberEnv(target.platform, "PORT", 1433, role),
    server: readEnv(target.platform, "HOST", "127.0.0.1", role),
    user: readEnv(target.platform, "USER", "sa", role),
  });

  if (typeof pool.connect === "function") {
    await pool.connect();
  }

  return DriverManager.getConnection(
    {
      driver: "mssql",
      ownsPool: true,
      pool: pool as Record<string, unknown>,
      ...readCommonConnectionOverrides(target, role),
    },
    configuration,
  );
}

async function importOptional(
  specifier: string,
  target: FunctionalTarget,
): Promise<Record<string, unknown>> {
  try {
    return (await import(specifier)) as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `Unable to load optional peer dependency "${specifier}" for functional platform ` +
        `"${target.platform}" (driver "${target.driver}"). Install it before running functional tests.`,
      { cause: error },
    );
  }
}

function readCommonConnectionOverrides(
  target: FunctionalTarget,
  _role: FunctionalConnectionRole = "default",
): Record<string, unknown> {
  const serverVersion =
    process.env.DATAZEN_FUNCTIONAL_SERVER_VERSION ??
    resolveFunctionalConfigProfile(target)?.serverVersion;

  if (serverVersion === undefined || serverVersion.trim() === "") {
    return {};
  }

  return { serverVersion };
}

export function resolveFunctionalConfigProfile(
  target: FunctionalTarget = resolveFunctionalTarget(),
): FunctionalConfigProfile | null {
  const configFilePath = process.env.DATAZEN_FUNCTIONAL_CONFIG_FILE;
  if (configFilePath === undefined || configFilePath.trim() === "") {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(configFilePath, "utf8")) as unknown;
  } catch (error) {
    throw new Error(`Unable to read functional config file "${configFilePath}".`, { cause: error });
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Functional config file "${configFilePath}" must contain a JSON object.`);
  }

  const config = parsed as FunctionalConfigFile;
  const profile =
    (config.targets !== undefined && config.targets[target.platform] !== undefined
      ? config.targets[target.platform]
      : config) ?? null;

  if (profile === null || typeof profile !== "object" || Array.isArray(profile)) {
    return null;
  }

  if (typeof profile.platform === "string" && profile.platform.trim() !== "") {
    const declaredPlatform = profile.platform.trim().toLowerCase();
    if (declaredPlatform !== target.platform) {
      throw new Error(
        `Functional config "${configFilePath}" targets platform "${declaredPlatform}" but ` +
          `DATAZEN_FUNCTIONAL_PLATFORM resolved to "${target.platform}".`,
      );
    }
  }

  return profile;
}

function readEnv(
  platform: FunctionalPlatformTarget,
  key: string,
  fallback: string,
  role: FunctionalConnectionRole = "default",
): string {
  const platformPrefix = platform.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const rolePrefix = role === "privileged" ? "PRIVILEGED_" : "";
  const configValue = readConfigValue(platform, key, role);

  if (role === "privileged") {
    return (
      process.env[`DATAZEN_FUNCTIONAL_${platformPrefix}_${rolePrefix}${key}`] ??
      process.env[`DATAZEN_FUNCTIONAL_${rolePrefix}${key}`] ??
      configValue ??
      readEnv(platform, key, fallback, "default")
    );
  }

  return (
    process.env[`DATAZEN_FUNCTIONAL_${platformPrefix}_${key}`] ??
    process.env[`DATAZEN_FUNCTIONAL_${key}`] ??
    configValue ??
    fallback
  );
}

function readNumberEnv(
  platform: FunctionalPlatformTarget,
  key: string,
  fallback: number,
  role: FunctionalConnectionRole = "default",
): number {
  const raw = readEnv(platform, key, String(fallback), role);
  const parsed = Number(raw);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric env value for ${platform}:${key} -> "${raw}"`);
  }

  return parsed;
}

function readBooleanEnv(
  platform: FunctionalPlatformTarget,
  key: string,
  fallback: boolean,
  role: FunctionalConnectionRole = "default",
): boolean {
  const raw = readEnv(platform, key, fallback ? "true" : "false", role)
    .trim()
    .toLowerCase();

  if (["1", "true", "yes", "on"].includes(raw)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(raw)) {
    return false;
  }

  throw new Error(`Invalid boolean env value for ${platform}:${key} -> "${raw}"`);
}

function readConfigValue(
  platform: FunctionalPlatformTarget,
  key: string,
  role: FunctionalConnectionRole = "default",
): string | undefined {
  const profile = resolveFunctionalConfigProfile({
    driver: PLATFORM_TO_DRIVER[platform].driver,
    platform,
  });
  const connection = role === "privileged" ? profile?.privilegedConnection : profile?.connection;

  if (connection === undefined || connection === null || typeof connection !== "object") {
    return undefined;
  }

  const value = pickConfigConnectionValue(connection, key);
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  return undefined;
}

function pickConfigConnectionValue(
  connection: Record<string, unknown>,
  envStyleKey: string,
): unknown {
  const snakeCaseKey = envStyleKey.toLowerCase();
  const camelCaseKey = snakeCaseKey.replace(/_([a-z0-9])/g, (_match, letter: string) =>
    letter.toUpperCase(),
  );

  for (const candidate of [envStyleKey, snakeCaseKey, camelCaseKey]) {
    if (Object.hasOwn(connection, candidate)) {
      return connection[candidate];
    }
  }

  return undefined;
}
