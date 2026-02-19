import { DbalException } from "./dbal-exception";

export class NestedTransactionsNotSupportedException extends DbalException {
  constructor(driverName: string) {
    super(`Driver "${driverName}" does not support nested transactions (savepoints).`);
  }
}
