import type { ParserException } from "../sql/parser";
import { initializeException } from "./_util";

export class ParseError extends Error {
  public static fromParserException(exception: ParserException): ParseError {
    return new ParseError("Unable to parse query.", exception);
  }

  constructor(message: string, cause?: unknown) {
    super(message);
    initializeException(this, new.target);

    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}
