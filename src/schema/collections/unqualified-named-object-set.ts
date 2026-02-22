import { ObjectAlreadyExists } from "./exception/object-already-exists";
import { ObjectDoesNotExist } from "./exception/object-does-not-exist";
import { ObjectSet } from "./object-set";

export class UnqualifiedNamedObjectSet<TObject extends { getName(): string }>
  implements ObjectSet<TObject>
{
  private readonly values = new Map<string, TObject>();

  public add(object: TObject): this {
    const key = normalizeName(object.getName());
    if (this.values.has(key)) {
      throw ObjectAlreadyExists.new(object.getName());
    }

    this.values.set(key, object);
    return this;
  }

  public hasByName(name: string): boolean {
    return this.values.has(normalizeName(name));
  }

  public getByName(name: string): TObject {
    const object = this.values.get(normalizeName(name));
    if (object === undefined) {
      throw ObjectDoesNotExist.new(name);
    }

    return object;
  }

  public removeByName(name: string): void {
    const key = normalizeName(name);
    if (!this.values.delete(key)) {
      throw ObjectDoesNotExist.new(name);
    }
  }

  public clear(): void {
    this.values.clear();
  }

  public toArray(): TObject[] {
    return [...this.values.values()];
  }

  public [Symbol.iterator](): Iterator<TObject> {
    return this.values.values();
  }
}

function normalizeName(name: string): string {
  return name.toLowerCase();
}
