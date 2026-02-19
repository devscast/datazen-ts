import { DbalException } from "./dbal-exception";

export class NoKeyValueException extends DbalException {
  constructor(columnCount: number) {
    super(`Cannot build key/value result from ${columnCount} column(s). At least 2 are required.`);
  }
}
