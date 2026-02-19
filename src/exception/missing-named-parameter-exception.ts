import { DbalException } from "./dbal-exception";

export class MissingNamedParameterException extends DbalException {
  constructor(name: string) {
    super(`Named parameter "${name}" does not have a bound value.`);
  }
}
