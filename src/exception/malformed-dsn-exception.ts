import { DbalException } from "./dbal-exception";

export class MalformedDsnException extends DbalException {
  constructor(message = "Malformed database connection URL") {
    super(message);
  }
}
