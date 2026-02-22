/**
 * Platform-specific parameters used when creating objects scoped to a table.
 */
export class TableConfiguration {
  constructor(private readonly maxIdentifierLength: number) {}

  public getMaxIdentifierLength(): number {
    return this.maxIdentifierLength;
  }
}
