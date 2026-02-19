import { DbalError } from "./dbal-error";

export class MissingPositionalParameterError extends DbalError {
  constructor(index: number) {
    super(`Positional parameter at index ${index} does not have a bound value.`);
  }
}
