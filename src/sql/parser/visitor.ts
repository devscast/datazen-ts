export interface Visitor {
  /**
   * Accepts an SQL fragment containing a positional parameter.
   */
  acceptPositionalParameter(sql: string): void;

  /**
   * Accepts an SQL fragment containing a named parameter.
   */
  acceptNamedParameter(sql: string): void;

  /**
   * Accepts any other SQL fragment.
   */
  acceptOther(sql: string): void;

  /**
   * Accepts an escaped question mark token (`??`) used to represent a literal `?`.
   *
   * Implementations may override this to preserve the escape sequence across
   * multiple parse passes (for example, DBAL-style array expansion followed by
   * driver-specific placeholder conversion). If omitted, the parser will
   * normalize `??` to `?` via `acceptOther()`.
   */
  acceptEscapedQuestionMark?(sql: string): void;
}
