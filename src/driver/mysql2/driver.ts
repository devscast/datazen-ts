import { type Driver, type DriverConnection, ParameterBindingStyle } from "../../driver";
import { DbalError } from "../../exception/index";
import { MySQLPlatform } from "../../platforms/mysql-platform";
import { ExceptionConverter as MySQLExceptionConverter } from "../api/mysql/exception-converter";
import { MySQL2Connection } from "./connection";
import type { MySQL2ConnectionParams } from "./types";

export class MySQL2Driver implements Driver {
  public readonly name = "mysql2";
  public readonly bindingStyle = ParameterBindingStyle.POSITIONAL;
  private readonly exceptionConverter = new MySQLExceptionConverter();
  private readonly platform = new MySQLPlatform();

  public async connect(params: Record<string, unknown>): Promise<DriverConnection> {
    const connectionParams = params as MySQL2ConnectionParams;
    const client = connectionParams.pool ?? connectionParams.connection ?? connectionParams.client;

    if (client === undefined) {
      throw new DbalError(
        "mysql2 connection requires one of `pool`, `connection`, or `client` in connection params.",
      );
    }

    const ownsClient = Boolean(connectionParams.ownsPool ?? connectionParams.ownsClient);
    return new MySQL2Connection(client, ownsClient);
  }

  public getExceptionConverter(): MySQLExceptionConverter {
    return this.exceptionConverter;
  }

  public getDatabasePlatform(): MySQLPlatform {
    return this.platform;
  }
}
