import { DbalError } from "./dbal-error";

export class NoActiveTransactionError extends DbalError {
  constructor() {
    super("There is no active transaction.");
  }
}
