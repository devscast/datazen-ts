import { initializeException } from "./_util";

export class MalformedDsnException extends Error {
  constructor(message = "Malformed database connection URL") {
    super(message);
    initializeException(this, new.target);
  }
}
