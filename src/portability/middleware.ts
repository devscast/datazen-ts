import { ColumnCase } from "../column-case";
import type { Driver as DriverInterface, DriverMiddleware } from "../driver";
import { Connection } from "./connection";
import { Driver } from "./driver";

export class Middleware implements DriverMiddleware {
  constructor(
    private readonly mode: number = Connection.PORTABILITY_NONE,
    private readonly caseMode: ColumnCase | null = null,
  ) {}

  public wrap(driver: DriverInterface): DriverInterface {
    if (this.mode === Connection.PORTABILITY_NONE) {
      return driver;
    }

    return new Driver(driver, this.mode, this.caseMode);
  }
}
