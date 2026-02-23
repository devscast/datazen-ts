/**
 * Contract for a driver exception.
 *
 * Driver exceptions provide the SQLSTATE of the driver
 * and the driver specific error code at the time the error occurred.
 */
export interface Exception extends Error {
  /**
   * Returns the SQLSTATE the driver was in at the time the error occurred.
   *
   * Returns null if the driver does not provide a SQLSTATE for the error occurred.
   */
  getSQLState(): string | null;
}
