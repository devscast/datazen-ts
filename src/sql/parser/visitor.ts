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
}
