import { initializeException } from "./_util";

export abstract class InvalidColumnType extends Error {
  protected constructor(message: string) {
    super(message);
    initializeException(this, new.target);
  }
}
