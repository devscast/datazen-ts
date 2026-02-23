import { initializeException } from "./_util";

export class InvalidArgumentException extends Error {
  constructor(message: string) {
    super(message);
    initializeException(this, new.target);
  }
}
