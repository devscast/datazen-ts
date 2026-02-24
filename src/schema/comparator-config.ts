export interface ComparatorConfigOptions {
  detectColumnRenames?: boolean;
  detectIndexRenames?: boolean;
  reportModifiedIndexes?: boolean;
}

export class ComparatorConfig {
  private readonly detectColumnRenames: boolean;
  private readonly detectIndexRenames: boolean;
  private readonly reportModifiedIndexes: boolean;

  constructor(options: ComparatorConfigOptions = {}) {
    this.detectColumnRenames = options.detectColumnRenames ?? false;
    this.detectIndexRenames = options.detectIndexRenames ?? false;
    this.reportModifiedIndexes = options.reportModifiedIndexes ?? false;
  }

  public isDetectColumnRenamesEnabled(): boolean {
    return this.detectColumnRenames;
  }

  public isDetectIndexRenamesEnabled(): boolean {
    return this.detectIndexRenames;
  }

  public withDetectRenamedColumns(detectRenamedColumns: boolean): ComparatorConfig {
    return new ComparatorConfig({
      detectColumnRenames: detectRenamedColumns,
      detectIndexRenames: this.detectIndexRenames,
      reportModifiedIndexes: this.reportModifiedIndexes,
    });
  }

  public getDetectRenamedColumns(): boolean {
    return this.detectColumnRenames;
  }

  public withDetectRenamedIndexes(detectRenamedIndexes: boolean): ComparatorConfig {
    return new ComparatorConfig({
      detectColumnRenames: this.detectColumnRenames,
      detectIndexRenames: detectRenamedIndexes,
      reportModifiedIndexes: this.reportModifiedIndexes,
    });
  }

  public getDetectRenamedIndexes(): boolean {
    return this.detectIndexRenames;
  }

  public withReportModifiedIndexes(reportModifiedIndexes: boolean): ComparatorConfig {
    return new ComparatorConfig({
      detectColumnRenames: this.detectColumnRenames,
      detectIndexRenames: this.detectIndexRenames,
      reportModifiedIndexes,
    });
  }

  public getReportModifiedIndexes(): boolean {
    return this.reportModifiedIndexes;
  }
}
