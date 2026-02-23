import { initializeException } from "./_util";

export class MissingNamedParameterException extends Error {
  constructor(name: string) {
    super(`Named parameter "${name}" does not have a bound value.`);
    initializeException(this, new.target);
  }
}
