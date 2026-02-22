import type { AbstractPlatform } from "../../platforms/abstract-platform";
import type { Name } from "../name";
import { Identifier } from "./identifier";

export class GenericName implements Name {
  private readonly identifiers: [Identifier, ...Identifier[]];

  constructor(firstIdentifier: Identifier, ...otherIdentifiers: Identifier[]) {
    this.identifiers = [firstIdentifier, ...otherIdentifiers];
  }

  public getIdentifiers(): [Identifier, ...Identifier[]] {
    return [...this.identifiers] as [Identifier, ...Identifier[]];
  }

  public toSQL(platform: AbstractPlatform): string {
    return this.identifiers.map((identifier) => identifier.toSQL(platform)).join(".");
  }

  public toString(): string {
    return this.identifiers.map((identifier) => identifier.toString()).join(".");
  }
}
