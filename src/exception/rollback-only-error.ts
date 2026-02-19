import { DbalError } from "./dbal-error";

export class RollbackOnlyError extends DbalError {
  constructor() {
    super("The current transaction is marked rollback-only and cannot be committed.");
  }
}
