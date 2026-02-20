import { ColumnCase } from "../column-case";
import {
  type DriverConnection,
  type Driver as DriverInterface,
  ParameterBindingStyle,
} from "../driver";
import type { ExceptionConverter } from "../driver/api/exception-converter";
import type { AbstractPlatform } from "../platforms/abstract-platform";
import { Connection } from "./connection";
import { Converter } from "./converter";
import { OptimizeFlags } from "./optimize-flags";

export class Driver implements DriverInterface {
  public readonly getDatabasePlatform?: () => AbstractPlatform;
  private readonly optimizeFlags = new OptimizeFlags();

  constructor(
    private readonly driver: DriverInterface,
    private readonly mode: number,
    private readonly caseMode: ColumnCase | null,
  ) {
    if (this.driver.getDatabasePlatform !== undefined) {
      this.getDatabasePlatform = (): AbstractPlatform => this.driver.getDatabasePlatform!();
    }
  }

  public get name(): string {
    return this.driver.name;
  }

  public get bindingStyle(): ParameterBindingStyle {
    return this.driver.bindingStyle;
  }

  public async connect(params: Record<string, unknown>): Promise<DriverConnection> {
    const connection = await this.driver.connect(params);
    let portability = this.mode;

    if (this.driver.getDatabasePlatform !== undefined) {
      portability = this.optimizeFlags.apply(this.driver.getDatabasePlatform(), portability);
    }

    const convertEmptyStringToNull = (portability & Connection.PORTABILITY_EMPTY_TO_NULL) !== 0;
    const rightTrimString = (portability & Connection.PORTABILITY_RTRIM) !== 0;
    const columnCase =
      this.caseMode !== null && (portability & Connection.PORTABILITY_FIX_CASE) !== 0
        ? this.caseMode
        : null;

    if (!convertEmptyStringToNull && !rightTrimString && columnCase === null) {
      return connection;
    }

    return new Connection(
      connection,
      new Converter(convertEmptyStringToNull, rightTrimString, columnCase),
    );
  }

  public getExceptionConverter(): ExceptionConverter {
    return this.driver.getExceptionConverter();
  }
}
