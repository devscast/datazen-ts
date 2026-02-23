import {
  type DriverConnection,
  type Driver as DriverInterface,
  ParameterBindingStyle,
} from "../driver";
import type { ExceptionConverter } from "../driver/api/exception-converter";
import type { AbstractPlatform } from "../platforms/abstract-platform";
import type { ServerVersionProvider } from "../server-version-provider";
import { Connection } from "./connection";
import type { Logger } from "./logger";

export class Driver implements DriverInterface {
  public readonly getDatabasePlatform: (versionProvider: ServerVersionProvider) => AbstractPlatform;

  constructor(
    private readonly driver: DriverInterface,
    private readonly logger: Logger,
  ) {
    this.getDatabasePlatform = (versionProvider: ServerVersionProvider): AbstractPlatform =>
      this.driver.getDatabasePlatform(versionProvider);
  }

  public get name(): string {
    return this.driver.name;
  }

  public get bindingStyle(): ParameterBindingStyle {
    return this.driver.bindingStyle;
  }

  public async connect(params: Record<string, unknown>): Promise<DriverConnection> {
    this.logger.info("Connecting with parameters {params}", {
      params: this.maskPassword(params),
    });

    const connection = await this.driver.connect(params);
    return new Connection(connection, this.logger);
  }

  public getExceptionConverter(): ExceptionConverter {
    return this.driver.getExceptionConverter();
  }

  private maskPassword(params: Record<string, unknown>): Record<string, unknown> {
    if (!Object.hasOwn(params, "password")) {
      return { ...params };
    }

    return {
      ...params,
      password: "<redacted>",
    };
  }
}
