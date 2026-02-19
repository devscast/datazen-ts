import { DbalError } from "./dbal-error";

export class MixedParameterStyleError extends DbalError {
  constructor() {
    super("Mixing positional and named parameters is not supported.");
  }
}
