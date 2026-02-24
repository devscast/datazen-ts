import { createHash } from "node:crypto";

import type { AbstractPlatform } from "../platforms/abstract-platform";

/**
 * Datazen base class for schema assets (table, column, index, sequence...).
 */
export abstract class AbstractAsset {
  protected _name = "";
  protected _namespace: string | null = null;
  protected _quoted = false;

  constructor(name: string) {
    this._setName(name);
  }

  protected _setName(name: string): void {
    this._quoted = this.isIdentifierQuoted(name);
    const normalized = this._quoted ? this.trimQuotes(name) : name;

    const parts = normalized.split(".");
    if (parts.length > 1) {
      this._namespace = parts[0] ?? null;
      this._name = parts.slice(1).join(".");
      return;
    }

    this._namespace = null;
    this._name = normalized;
  }

  protected getNameParser(): unknown {
    return null;
  }

  protected setName(_name: unknown): void {}

  public getName(): string {
    if (this._namespace === null) {
      return this._name;
    }

    return `${this._namespace}.${this._name}`;
  }

  public getNamespaceName(): string | null {
    return this._namespace;
  }

  public isInDefaultNamespace(defaultNamespaceName: string): boolean {
    return this._namespace === null || this._namespace === defaultNamespaceName;
  }

  public getShortestName(defaultNamespaceName: string | null): string {
    if (defaultNamespaceName !== null && this._namespace === defaultNamespaceName) {
      return this._name.toLowerCase();
    }

    return this.getName().toLowerCase();
  }

  public isQuoted(): boolean {
    return this._quoted;
  }

  protected isIdentifierQuoted(identifier: string): boolean {
    return identifier.startsWith("`") || identifier.startsWith('"') || identifier.startsWith("[");
  }

  protected trimQuotes(identifier: string): string {
    return identifier
      .replaceAll("`", "")
      .replaceAll('"', "")
      .replaceAll("[", "")
      .replaceAll("]", "");
  }

  public getQuotedName(platform: AbstractPlatform): string {
    const keywords = platform.getReservedKeywordsList();

    return this.getName()
      .split(".")
      .map((identifier) => {
        if (this._quoted || keywords.isKeyword(identifier)) {
          return platform.quoteSingleIdentifier(identifier);
        }

        return identifier;
      })
      .join(".");
  }

  protected _generateIdentifierName(
    columnNames: readonly string[],
    prefix = "",
    maxSize = 30,
  ): string {
    const hash = columnNames
      .map((columnName) => createHash("sha1").update(columnName).digest("hex").slice(0, 8))
      .join("");

    return `${prefix}_${hash}`.slice(0, maxSize).toUpperCase();
  }
}
