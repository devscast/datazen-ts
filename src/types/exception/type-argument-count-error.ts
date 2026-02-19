import { TypesException } from "./types-exception";

export class TypeArgumentCountError extends TypesException {
  public static new(name: string, previous?: unknown): TypeArgumentCountError {
    return new TypeArgumentCountError(
      `Type "${name}" could not be instantiated without constructor arguments.`,
      previous,
    );
  }

  constructor(
    message: string,
    public readonly previous?: unknown,
  ) {
    super(message);
  }
}
