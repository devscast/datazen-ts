import type { Driver } from "../driver";
import { SQLServerPlatform } from "../platforms/sql-server-platform";
import type { ServerVersionProvider } from "../server-version-provider";
import type { ExceptionConverter as DriverExceptionConverter } from "./api/exception-converter";
import { ExceptionConverter } from "./api/sql-server/exception-converter";

export abstract class AbstractSQLServerDriver implements Driver {
  public getDatabasePlatform(_versionProvider: ServerVersionProvider): SQLServerPlatform {
    return new SQLServerPlatform();
  }

  public getExceptionConverter(): DriverExceptionConverter {
    return new ExceptionConverter();
  }

  public abstract connect(params: Record<string, unknown>): ReturnType<Driver["connect"]>;
}
