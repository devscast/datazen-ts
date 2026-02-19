import { DbalError } from "./dbal-error";

export class NestedTransactionsNotSupportedError extends DbalError {
  constructor(driverName: string) {
    super(`Driver "${driverName}" does not support nested transactions (savepoints).`);
  }
}
