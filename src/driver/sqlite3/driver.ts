import type { DriverConnection } from "../../driver";
import { AbstractSQLiteDriver } from "../abstract-sqlite-driver";
import { ParameterBindingStyle } from "../internal-parameter-binding-style";
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

    return new SQLite3Connection(client, Boolean(connectionParams.ownsClient));
  }
}
