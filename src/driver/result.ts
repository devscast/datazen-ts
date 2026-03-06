type AssociativeRow = Record<string, unknown>;

export interface Result {
  fetchNumeric<T = unknown>(): T[] | false;
  fetchAssociative<T extends AssociativeRow = AssociativeRow>(): T | false;
  fetchOne<T = unknown>(): T | false;
  fetchAllNumeric<T = unknown>(): T[][];
  fetchAllAssociative<T extends AssociativeRow = AssociativeRow>(): T[];
  fetchFirstColumn<T = unknown>(): T[];
  rowCount(): number | string;
  columnCount(): number;
  free(): void;
}
