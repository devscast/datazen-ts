import { DbalError } from "./dbal-error";

export class UnknownDriverError extends DbalError {
  constructor(driver: string, availableDrivers: string[]) {
    super(
      `Unknown driver "${driver}". Available drivers: ${availableDrivers.join(", ") || "none"}.`,
    );
  }
}
