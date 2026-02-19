import { DbalException } from "./dbal-exception";

export class MixedParameterStyleException extends DbalException {
  constructor() {
    super("Mixing positional and named parameters is not supported.");
  }
}
