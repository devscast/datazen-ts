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

    const key = normalizeName(name);
    if (this.namedValues.has(key)) {
      throw ObjectAlreadyExists.new(name);
    }

    this.namedValues.set(key, object);
    return this;
  }

  public hasByName(name: string): boolean {
    return this.namedValues.has(normalizeName(name));
  }

  public getByName(name: string): TObject {
    const object = this.namedValues.get(normalizeName(name));
    if (object === undefined) {
      throw ObjectDoesNotExist.new(name);
    }

    return object;
  }

  public removeByName(name: string): void {
    const key = normalizeName(name);
    if (!this.namedValues.delete(key)) {
      throw ObjectDoesNotExist.new(name);
    }
  }

  public clear(): void {
    this.namedValues.clear();
    this.unnamedValues.length = 0;
  }

  public toArray(): TObject[] {
    return [...this.namedValues.values(), ...this.unnamedValues];
  }

  public [Symbol.iterator](): Iterator<TObject> {
    return this.toArray()[Symbol.iterator]();
  }
}

function normalizeName(name: string): string {
  return name.toLowerCase();
}
