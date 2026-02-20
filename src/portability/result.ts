import type { DriverQueryResult } from "../driver";
import { Converter } from "./converter";

export class Result {
  constructor(
    private readonly result: DriverQueryResult,
    private readonly converter: Converter,
  ) {}

  public toDriverQueryResult(): DriverQueryResult {
    return this.converter.convertQueryResult(this.result);
  }
}
