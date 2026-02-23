import { ParameterType } from "../parameter-type";
import type { Result } from "./result";

export interface Statement {
  /**
   * Binds a value to a corresponding named or positional
   * placeholder in the SQL statement that was used to prepare the statement.
   *
   * As mentioned above, the named parameters are not natively supported by the mysql2 driver, use executeQuery(),
   * fetchAll(), fetchArray(), fetchColumn(), fetchAssoc() methods to have the named parameter emulated by datazen.
   *
   * @param number|string    param Parameter identifier. For a prepared statement using named placeholders,
   *                             this will be a parameter name of the form :name. For a prepared statement
   *                             using question mark placeholders, this will be the 1-indexed position
   *                             of the parameter.
   * @param mixed         value The value to bind to the parameter.
   * @param ParameterType type  Explicit data type for the parameter using the {@see ParameterType}
   *                             constants.
   *
   * @throws Exception
   */
  bindValue(param: string | number, value: unknown, type?: ParameterType): void;

  /**
   * Executes a prepared statement
   *
   * @throws Exception
   */
  execute(): Promise<Result>;
}
