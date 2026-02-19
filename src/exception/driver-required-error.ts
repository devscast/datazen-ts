import { DbalError } from "./dbal-error";

export class DriverRequiredError extends DbalError {
  constructor() {
    super("Either `driver`, `driverClass`, or `driverInstance` must be provided.");
  }
}
