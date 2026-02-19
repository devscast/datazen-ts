import { type Driver, type DriverConnection, ParameterBindingStyle } from "../../driver";
import { DbalException } from "../../exception/index";
import { SQLServerPlatform } from "../../platforms/sql-server-platform";
import { ExceptionConverter as SQLSrvExceptionConverter } from "../api/sqlsrv/exception-converter";
import { MSSQLConnection } from "./connection";
import type { MSSQLConnectionParams } from "./types";

export class MSSQLDriver implements Driver {
  public readonly name = "mssql";
  public readonly bindingStyle = ParameterBindingStyle.NAMED;
  private readonly exceptionConverter = new SQLSrvExceptionConverter();
  private readonly platform = new SQLServerPlatform();

  public async connect(params: Record<string, unknown>): Promise<DriverConnection> {
    const connectionParams = params as MSSQLConnectionParams;
    const client = connectionParams.pool ?? connectionParams.connection ?? connectionParams.client;

    if (client === undefined) {
      throw new DbalException(
        "mssql connection requires one of `pool`, `connection`, or `client` in connection params.",
      );
    }

    const ownsClient = Boolean(connectionParams.ownsPool ?? connectionParams.ownsClient);
    return new MSSQLConnection(client, ownsClient);
  }

  public getExceptionConverter(): SQLSrvExceptionConverter {
    return this.exceptionConverter;
  }

  public getDatabasePlatform(): SQLServerPlatform {
    return this.platform;
  }
}
