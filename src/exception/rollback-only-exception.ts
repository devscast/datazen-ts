import { DbalException } from "./dbal-exception";

export class RollbackOnlyException extends DbalException {
  constructor() {
    super("The current transaction is marked rollback-only and cannot be committed.");
  }
}
