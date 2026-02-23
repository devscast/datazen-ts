import { coerce, gte } from "semver";

import { type Driver, type DriverConnection, ParameterBindingStyle } from "../../driver";
import { DbalException } from "../../exception/index";
import { AbstractMySQLPlatform } from "../../platforms/abstract-mysql-platform";
import { InvalidPlatformVersion } from "../../platforms/exception/invalid-platform-version";
import { MariaDBPlatform } from "../../platforms/mariadb-platform";
import { MariaDB1010Platform } from "../../platforms/mariadb1010-platform";
import { MariaDB1052Platform } from "../../platforms/mariadb1052-platform";
import { MariaDB1060Platform } from "../../platforms/mariadb1060-platform";
import { MariaDB110700Platform } from "../../platforms/mariadb110700-platform";
import { MySQLPlatform } from "../../platforms/mysql-platform";
import { MySQL80Platform } from "../../platforms/mysql80-platform";
import { MySQL84Platform } from "../../platforms/mysql84-platform";
import { type ServerVersionProvider } from "../../server-version-provider";
import { ExceptionConverter as MySQLExceptionConverter } from "../api/mysql/exception-converter";
import { MySQL2Connection } from "./connection";
import type { MySQL2ConnectionParams } from "./types";

export class MySQL2Driver implements Driver {
  public readonly name = "mysql2";
  public readonly bindingStyle = ParameterBindingStyle.POSITIONAL;
  private readonly exceptionConverter = new MySQLExceptionConverter();

  public async connect(params: Record<string, unknown>): Promise<DriverConnection> {
    const connectionParams = params as MySQL2ConnectionParams;
    const client = connectionParams.pool ?? connectionParams.connection ?? connectionParams.client;

    if (client === undefined) {
      throw new DbalException(
        "mysql2 connection requires one of `pool`, `connection`, or `client` in connection params.",
      );
    }

    const ownsClient = Boolean(connectionParams.ownsPool ?? connectionParams.ownsClient);
    return new MySQL2Connection(client, ownsClient);
  }

  public getExceptionConverter(): MySQLExceptionConverter {
    return this.exceptionConverter;
  }

  public getDatabasePlatform(versionProvider: ServerVersionProvider): AbstractMySQLPlatform {
    const version = versionProvider.getServerVersion();

    if (typeof version !== "string") {
      // Best effort parity: async providers can't be consumed from this sync API.
      return new MySQLPlatform();
    }

    if (version.toLowerCase().includes("mariadb")) {
      const mariaDbVersion = this.getMariaDbMysqlVersionNumber(version);
      if (gte(mariaDbVersion, "11.7.0")) {
        return new MariaDB110700Platform();
      }

      if (gte(mariaDbVersion, "10.10.0")) {
        return new MariaDB1010Platform();
      }

      if (gte(mariaDbVersion, "10.6.0")) {
        return new MariaDB1060Platform();
      }

      if (gte(mariaDbVersion, "10.5.2")) {
        return new MariaDB1052Platform();
      }

      return new MariaDBPlatform();
    }

    const mysqlVersion = coerce(version)?.version;
    if (mysqlVersion === undefined) {
      throw InvalidPlatformVersion.new(version, "<major_version>.<minor_version>.<patch_version>");
    }

    if (mysqlVersion !== undefined && gte(mysqlVersion, "8.4.0")) {
      return new MySQL84Platform();
    }

    if (mysqlVersion !== undefined && gte(mysqlVersion, "8.0.0")) {
      return new MySQL80Platform();
    }

    return new MySQLPlatform();
  }

  private getMariaDbMysqlVersionNumber(versionString: string): string {
    const match = /^(?:5\.5\.5-)?(?:mariadb-)?(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)/i.exec(
      versionString,
    );

    if (match?.groups === undefined) {
      throw InvalidPlatformVersion.new(
        versionString,
        "^(?:5.5.5-)?(mariadb-)?<major_version>.<minor_version>.<patch_version>",
      );
    }

    return `${match.groups.major}.${match.groups.minor}.${match.groups.patch}`;
  }
}
