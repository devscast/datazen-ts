export interface SyncQueryConnection {
  fetchOne<T = unknown>(sql: string, params?: unknown[]): T | false;
  iterateNumeric<T extends unknown[] = unknown[]>(sql: string, params?: unknown[]): Iterable<T>;
  iterateColumn<T = unknown>(sql: string, params?: unknown[]): Iterable<T>;
}
