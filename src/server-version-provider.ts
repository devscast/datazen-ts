export interface ServerVersionProvider {
  getServerVersion(): Promise<string>;
}
