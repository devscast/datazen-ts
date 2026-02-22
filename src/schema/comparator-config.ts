export interface ComparatorConfigOptions {
  detectColumnRenames?: boolean;
  detectIndexRenames?: boolean;
}

export class ComparatorConfig {
  private readonly detectColumnRenames: boolean;
  private readonly detectIndexRenames: boolean;

  constructor(options: ComparatorConfigOptions = {}) {
    this.detectColumnRenames = options.detectColumnRenames ?? false;
    this.detectIndexRenames = options.detectIndexRenames ?? false;
  }

  public isDetectColumnRenamesEnabled(): boolean {
    return this.detectColumnRenames;
  }

  public isDetectIndexRenamesEnabled(): boolean {
    return this.detectIndexRenames;
  }
}
