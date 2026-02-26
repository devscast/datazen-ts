import type { Connection as DriverConnection } from "../../driver/connection";
import { ParameterBindingStyle } from "../_internal";
import { AbstractSQLiteDriver } from "../abstract-sqlite-driver";
import { SQLite3Connection } from "./connection";
import type { SQLite3ConnectionParams } from "./types";

export class SQLite3Driver extends AbstractSQLiteDriver {
  public readonly name = "sqlite3";
  public readonly bindingStyle = ParameterBindingStyle.POSITIONAL;

  public async connect(params: Record<string, unknown>): Promise<DriverConnection> {
    const connectionParams = params as SQLite3ConnectionParams;
    const client =
      connectionParams.database ?? connectionParams.connection ?? connectionParams.client;

    if (client === undefined) {
      throw new Error(
        "sqlite3 connection requires one of `database`, `connection`, or `client` in connection params.",
      );
    }

    const connection = new SQLite3Connection(client, Boolean(connectionParams.ownsClient));
    await connection.query("PRAGMA foreign_keys=ON");
    return connection;
  }
}
