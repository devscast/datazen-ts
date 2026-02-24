import { ObjectAlreadyExists } from "./exception/object-already-exists";
import { ObjectDoesNotExist } from "./exception/object-does-not-exist";
import { ObjectSet } from "./object-set";

export class OptionallyUnqualifiedNamedObjectSet<TObject extends { getObjectName(): string | null }>
  implements ObjectSet<TObject>
{
  private readonly namedValues = new Map<string, TObject>();
  private readonly unnamedValues: TObject[] = [];

  public add(object: TObject): this {
    const name = object.getObjectName();

    if (name === null) {
      this.unnamedValues.push(object);
      return this;
    }

    const key = this.getKey(name);
    if (this.namedValues.has(key)) {
      throw ObjectAlreadyExists.new(name);
    }

    this.namedValues.set(key, object);
    return this;
  }

  public hasByName(name: string): boolean {
    return this.namedValues.has(this.getKey(name));
  }

  public getByName(name: string): TObject {
    const object = this.namedValues.get(this.getKey(name));
    if (object === undefined) {
      throw ObjectDoesNotExist.new(name);
    }

    return object;
  }

  public removeByName(name: string): void {
    const key = this.getKey(name);
    if (!this.namedValues.delete(key)) {
      throw ObjectDoesNotExist.new(name);
    }
  }

  public isEmpty(): boolean {
    return this.namedValues.size === 0 && this.unnamedValues.length === 0;
  }

  public get(name: string | { toString(): string }): TObject | null {
    return this.namedValues.get(this.getKey(name)) ?? null;
  }

  public remove(name: string | { toString(): string }): void {
    this.removeByName(String(name));
  }

  public modify(
    name: string | { toString(): string },
    modification: (object: TObject) => TObject,
  ): void {
    const key = this.getKey(name);
    const current = this.namedValues.get(key);

    if (current === undefined) {
      throw ObjectDoesNotExist.new(String(name));
    }

    this.replace(key, current, modification);
  }

  public clear(): void {
    this.namedValues.clear();
    this.unnamedValues.length = 0;
  }

  public toArray(): TObject[] {
    return [...this.namedValues.values(), ...this.unnamedValues];
  }

  public toList(): TObject[] {
    return this.toArray();
  }

  public [Symbol.iterator](): Iterator<TObject> {
    return this.getIterator();
  }

  public getIterator(): Iterator<TObject> {
    return this.toArray()[Symbol.iterator]();
  }

  private removeByKey(key: string): void {
    this.namedValues.delete(key);
  }

  private replace(key: string, current: TObject, modification: (object: TObject) => TObject): void {
    this.removeByKey(key);

    try {
      this.add(modification(current));
    } catch (error) {
      this.add(current);
      throw error;
    }
  }

  private getKey(name: string | { toString(): string }): string {
    return normalizeName(String(name));
  }
}

function normalizeName(name: string): string {
  return name.toLowerCase();
}
