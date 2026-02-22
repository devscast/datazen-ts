import { AbstractAsset } from "./abstract-asset";

/**
 * Wrapper around raw SQL identifiers (table names, column names, etc.).
 */
export class Identifier extends AbstractAsset {
  constructor(identifier: string, quote = false) {
    super(identifier);

    if (quote && !this._quoted) {
      this._setName(`"${this.getName()}"`);
    }
  }
}
