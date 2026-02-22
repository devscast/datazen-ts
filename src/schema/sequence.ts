import { AbstractAsset } from "./abstract-asset";
import { SequenceEditor } from "./sequence-editor";

export class Sequence extends AbstractAsset {
  constructor(
    name: string,
    private allocationSize: number = 1,
    private initialValue: number = 1,
    private cacheSize: number | null = null,
  ) {
    super(name);
  }

  public getAllocationSize(): number {
    return this.allocationSize;
  }

  public getInitialValue(): number {
    return this.initialValue;
  }

  public getCacheSize(): number | null {
    return this.cacheSize;
  }

  public static editor(): SequenceEditor {
    return new SequenceEditor();
  }

  public edit(): SequenceEditor {
    return Sequence.editor()
      .setName(this.getName())
      .setAllocationSize(this.allocationSize)
      .setInitialValue(this.initialValue)
      .setCacheSize(this.cacheSize);
  }
}
