import type { Driver as DriverInterface, DriverMiddleware } from "../driver";
import { ConsoleLogger } from "./console-logger";
import { Driver } from "./driver";
import type { Logger } from "./logger";

export class Middleware implements DriverMiddleware {
  constructor(private readonly logger: Logger = new ConsoleLogger()) {}

  public wrap(driver: DriverInterface): DriverInterface {
    return new Driver(driver, this.logger);
  }
}
