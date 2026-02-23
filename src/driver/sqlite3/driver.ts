import { type Driver, type DriverConnection, ParameterBindingStyle } from "../../driver";
import { DbalException } from "../../exception/index";
import { SQLitePlatform } from "../../platforms/sqlite-platform";
import type { ServerVersionProvider } from "../../server-version-provider";
import { ExceptionConverter as SQLiteExceptionConverter } from "../api/sqlite/exception-converter";
import { SQLite3Connection } from "./connection";
import type { SQLite3ConnectionParams } from "./types";

export class SQLite3Driver implements Driver {
  public readonly name = "sqlite3";
  public readonly bindingStyle = ParameterBindingStyle.POSITIONAL;
  private readonly exceptionConverter = new SQLiteExceptionConverter();
  private readonly platform = new SQLitePlatform();

  public async connect(params: Record<string, unknown>): Promise<DriverConnection> {
    const connectionParams = params as SQLite3ConnectionParams;
    const client =
      connectionParams.database ?? connectionParams.connection ?? connectionParams.client;

    if (client === undefined) {
      throw new DbalException(
        "sqlite3 connection requires one of `database`, `connection`, or `client` in connection params.",
      );
    }

    return new SQLite3Connection(client, Boolean(connectionParams.ownsClient));
  }

  public getExceptionConverter(): SQLiteExceptionConverter {
    return this.exceptionConverter;
  }

  public getDatabasePlatform(_versionProvider: ServerVersionProvider): SQLitePlatform {
    return this.platform;
  }
}
