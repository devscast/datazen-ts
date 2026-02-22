export interface ObjectSet<TObject> extends Iterable<TObject> {
  add(object: TObject): this;
  hasByName(name: string): boolean;
  getByName(name: string): TObject;
  removeByName(name: string): void;
  clear(): void;
  toArray(): TObject[];
}
