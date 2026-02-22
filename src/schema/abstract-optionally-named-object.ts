import { AbstractAsset } from "./abstract-asset";
import { OptionallyNamedObject } from "./optionally-named-object";

export abstract class AbstractOptionallyNamedObject
  extends AbstractAsset
  implements OptionallyNamedObject<string>
{
  private readonly hasName: boolean;

  constructor(name: string | null) {
    super(name ?? "");
    this.hasName = name !== null;
  }

  public getObjectName(): string | null {
    if (!this.hasName) {
      return null;
    }

    return this.getName();
  }
}
