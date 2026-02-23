import { Result } from "./result";

export class FetchUtils {
  static fetchOne<T = unknown>(result: Result): T | false {
    const row = result.fetchNumeric();
    if (row === false) {
      return false;
    }
    return row[0] as T;
  }

  static fetchAllNumeric<T = unknown>(result: Result): T[][] {
    const rows: T[][] = [];

    let row = result.fetchNumeric<T>();
    while (row !== false) {
      rows.push(row as T[]);
      row = result.fetchNumeric<T>();
    }

    return rows;
  }

  static fetchFirstColumn<T = unknown>(result: Result): T[] {
    const rows: T[] = [];

    let value = result.fetchOne<T>();
    while (value !== false) {
      rows.push(value);
      value = result.fetchOne<T>();
    }

    return rows;
  }
}
