import type { Driver } from "../../driver";
import type { AbstractPlatform } from "../../platforms/abstract-platform";
import type { ServerVersionProvider } from "../../server-version-provider";
import type { ExceptionConverter } from "../api/exception-converter";
import type { Connection as DriverConnection } from "../connection";

export abstract class AbstractDriverMiddleware implements Driver {
  constructor(private readonly wrappedDriver: Driver) {}

  public async connect(params: Record<string, unknown>): Promise<DriverConnection> {
    return this.wrappedDriver.connect(params);
  }

  public getDatabasePlatform(versionProvider: ServerVersionProvider): AbstractPlatform {
    return this.wrappedDriver.getDatabasePlatform(versionProvider);
  }

  public getExceptionConverter(): ExceptionConverter {
    return this.wrappedDriver.getExceptionConverter();
  }
}
