import { ParameterType } from "../../parameter-type";
import type { Result as DriverResult } from "../result";
import type { Statement as DriverStatement } from "../statement";
import type { MSSQLConnection } from "./connection";

export class MSSQLStatement implements DriverStatement {
  private readonly parameters: Record<string, unknown> = {};

  constructor(
    private readonly connection: MSSQLConnection,
    private readonly sql: string,
  ) {}

  public bindValue(
    param: string | number,
    value: unknown,
    _type: ParameterType = ParameterType.STRING,
  ): void {
    if (typeof param === "number") {
      this.parameters[`p${param}`] = value;
      return;
    }

    const name = param.startsWith(":") || param.startsWith("@") ? param.slice(1) : param;
    this.parameters[name] = value;
  }

  public async execute(): Promise<DriverResult> {
    return this.connection.executePrepared(this.sql, this.parameters);
  }
}
