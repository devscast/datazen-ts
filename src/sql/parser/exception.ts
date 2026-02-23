import { initializeException } from "../../exception/_util";

export class Exception extends Error {
  constructor(message: string) {
    super(message);
    initializeException(this, new.target);
  }
}
