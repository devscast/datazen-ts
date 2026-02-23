import { type Driver, type DriverConnection, ParameterBindingStyle } from "../../driver";
import { DbalException } from "../../exception/index";
import { InvalidPlatformVersion } from "../../platforms/exception/invalid-platform-version";
import { PostgreSQLPlatform } from "../../platforms/postgre-sql-platform";
import { PostgreSQL120Platform } from "../../platforms/postgre-sql120-platform";
import type { ServerVersionProvider } from "../../server-version-provider";
import { ExceptionConverter as PgSQLExceptionConverter } from "../api/pgsql/exception-converter";
import { PgConnection } from "./connection";
import type { PgConnectionParams } from "./types";

export class PgDriver implements Driver {
  public readonly name = "pg";
  public readonly bindingStyle = ParameterBindingStyle.POSITIONAL;
  private readonly exceptionConverter = new PgSQLExceptionConverter();
  private readonly platform = new PostgreSQLPlatform();
  private readonly platform120 = new PostgreSQL120Platform();

  public async connect(params: Record<string, unknown>): Promise<DriverConnection> {
    const connectionParams = params as PgConnectionParams;
    const client = connectionParams.pool ?? connectionParams.connection ?? connectionParams.client;

    if (client === undefined) {
      throw new DbalException(
        "pg connection requires one of `pool`, `connection`, or `client` in connection params.",
      );
    }

    const ownsClient = Boolean(connectionParams.ownsPool ?? connectionParams.ownsClient);
    return new PgConnection(client, ownsClient);
  }

  public getExceptionConverter(): PgSQLExceptionConverter {
    return this.exceptionConverter;
  }

  public getDatabasePlatform(_versionProvider: ServerVersionProvider): PostgreSQLPlatform {
    const version = _versionProvider.getServerVersion();
    if (typeof version !== "string") {
      return this.platform;
    }

    const match = /^(?<major>\d+)(?:\.(?<minor>\d+)(?:\.(?<patch>\d+))?)?/.exec(version);
    if (match?.groups === undefined) {
      throw InvalidPlatformVersion.new(version, "<major_version>.<minor_version>.<patch_version>");
    }

    const major = Number.parseInt(match.groups.major ?? "0", 10);
    if (Number.isNaN(major)) {
      throw InvalidPlatformVersion.new(version, "<major_version>.<minor_version>.<patch_version>");
    }

    if (major >= 12) {
      return this.platform120;
    }

    return this.platform;
  }
}
