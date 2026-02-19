import { DbalError } from "./dbal-error";

export class NoKeyValueError extends DbalError {
  constructor(columnCount: number) {
    super(`Cannot build key/value result from ${columnCount} column(s). At least 2 are required.`);
  }
}
