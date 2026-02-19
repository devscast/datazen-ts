import { DbalException } from "./dbal-exception";

export class DriverRequiredException extends DbalException {
  constructor() {
    super("Either `driver`, `driverClass`, or `driverInstance` must be provided.");
  }
}
