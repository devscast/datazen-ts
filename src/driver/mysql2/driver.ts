import type { DriverConnection } from "../../driver";
import { AbstractMySQLDriver } from "../abstract-mysql-driver";
import { ParameterBindingStyle } from "../internal-parameter-binding-style";
import { MySQL2Connection } from "./connection";
import type { MySQL2ConnectionParams } from "./types";

export class MySQL2Driver extends AbstractMySQLDriver {
  public readonly name = "mysql2";
  public readonly bindingStyle = ParameterBindingStyle.POSITIONAL;

  public async connect(params: Record<string, unknown>): Promise<DriverConnection> {
    const connectionParams = params as MySQL2ConnectionParams;
    const client = connectionParams.pool ?? connectionParams.connection ?? connectionParams.client;

    if (client === undefined) {
      throw new Error(
        "mysql2 connection requires one of `pool`, `connection`, or `client` in connection params.",
      );
    }

    const ownsClient = Boolean(connectionParams.ownsPool ?? connectionParams.ownsClient);
    return new MySQL2Connection(client, ownsClient);
  }
}
