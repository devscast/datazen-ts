import { DbalException } from "./dbal-exception";

export class UnknownDriverException extends DbalException {
  constructor(driver: string, availableDrivers: string[]) {
    super(
      `Unknown driver "${driver}". Available drivers: ${availableDrivers.join(", ") || "none"}.`,
    );
  }
}
