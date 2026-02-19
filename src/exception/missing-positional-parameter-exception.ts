import { DbalException } from "./dbal-exception";

export class MissingPositionalParameterException extends DbalException {
  constructor(index: number) {
    super(`Positional parameter at index ${index} does not have a bound value.`);
  }
}
