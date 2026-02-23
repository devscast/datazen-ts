export interface DriverQueryResult {
  rows: Array<Record<string, unknown>>;
  columns?: string[];
  rowCount?: number;
}

export interface DriverExecutionResult {
  affectedRows: number;
  insertId?: number | string | null;
}
