import { AbstractAsset } from "./abstract-asset";
import { NamedObject } from "./named-object";

export abstract class AbstractNamedObject extends AbstractAsset implements NamedObject<string> {
  public getObjectName(): string {
    return this.getName();
  }

  protected setName(name: string | null): void {
    if (name === null) {
      return;
    }

    this._setName(name);
  }
}
