import type { DriverConnection } from "../../driver";
import { AbstractPostgreSQLDriver } from "../abstract-postgre-sql-driver";
import { ParameterBindingStyle } from "../internal-parameter-binding-style";
import { PgConnection } from "./connection";
import type { PgConnectionParams } from "./types";

export class PgDriver extends AbstractPostgreSQLDriver {
  public readonly name = "pg";
  public readonly bindingStyle = ParameterBindingStyle.POSITIONAL;

  public async connect(params: Record<string, unknown>): Promise<DriverConnection> {
    const connectionParams = params as PgConnectionParams;
    const client = connectionParams.pool ?? connectionParams.connection ?? connectionParams.client;

    if (client === undefined) {
      throw new Error(
        "pg connection requires one of `pool`, `connection`, or `client` in connection params.",
      );
    }

    const ownsClient = Boolean(connectionParams.ownsPool ?? connectionParams.ownsClient);
    return new PgConnection(client, ownsClient);
  }
}
