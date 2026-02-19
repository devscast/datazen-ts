import { DbalError } from "./dbal-error";

export class MissingNamedParameterError extends DbalError {
  constructor(name: string) {
    super(`Named parameter "${name}" does not have a bound value.`);
  }
}
