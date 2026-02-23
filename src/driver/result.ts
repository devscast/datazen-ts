type AssociativeRow = Record<string, unknown>;

/**
 * Driver-level statement execution result.
 */
export interface Result {
  /**
   * Returns the next row of the result as a numeric array or FALSE if there are no more rows.
   *
   * @throws Exception
   */
  fetchNumeric<T = unknown>(): T[] | false;

  /**
   * Returns the next row of the result as an associative array or FALSE if there are no more rows.
   *
   * @throws Exception
   */
  fetchAssociative<T extends AssociativeRow = AssociativeRow>(): T | false;

  /**
   * Returns the first value of the next row of the result or FALSE if there are no more rows.
   *
   * @throws Exception
   */
  fetchOne<T = unknown>(): T | false;

  /**
   * Returns an array containing all of the result rows represented as numeric arrays.
   *
   * @throws Exception
   */
  fetchAllNumeric<T = unknown>(): T[][];

  /**
   * Returns an array containing all of the result rows represented as associative arrays.
   *
   * @throws Exception
   */
  fetchAllAssociative<T extends AssociativeRow = AssociativeRow>(): T[];

  /**
   * Returns an array containing the values of the first column of the result.
   *
   * @throws Exception
   */
  fetchFirstColumn<T = unknown>(): T[];

  /**
   * Returns the number of rows affected by the DELETE, INSERT, or UPDATE statement that produced the result.
   *
   * If the statement executed a SELECT query or a similar platform-specific SQL (e.g. DESCRIBE, SHOW, etc.),
   * some database drivers may return the number of rows returned by that query. However, this behaviour
   * is not guaranteed for all drivers and should not be relied on in portable applications.
   *
   * If the number of rows exceeds {@see PHP_INT_MAX}, it might be returned as string if the driver supports it.
   *
   * @return int|numeric-string
   *
   * @throws Exception
   */
  rowCount(): number | string;

  /**
   * Returns the number of columns in the result
   *
   * @return int The number of columns in the result. If the columns cannot be counted,
   *             this method must return 0.
   *
   * @throws Exception
   */
  columnCount(): number;

  /**
   * Discards the non-fetched portion of the result, enabling the originating statement to be executed again.
   */
  free(): void;
}
