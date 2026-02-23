export interface ServerVersionProvider {
  /**
   * Returns the database server version
   */
  getServerVersion(): string | Promise<string>;
}
