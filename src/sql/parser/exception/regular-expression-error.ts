import { Exception } from "../exception";

export class RegularExpressionError extends Exception {
  constructor(message: string, code: number) {
    super(message);
    this.name = "RegularExpressionError";
    Object.defineProperty(this, "code", {
      configurable: true,
      enumerable: false,
      value: code,
      writable: true,
    });
  }
}
