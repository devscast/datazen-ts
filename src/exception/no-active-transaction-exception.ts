import { DbalException } from "./dbal-exception";

export class NoActiveTransactionException extends DbalException {
  constructor() {
    super("There is no active transaction.");
  }
}
