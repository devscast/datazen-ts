import type { ExceptionConverter } from "./driver/api/exception-converter";
import type { Connection as DriverConnection } from "./driver/connection";
import type { Middleware as DriverMiddleware } from "./driver/middleware";
import type { AbstractPlatform } from "./platforms/abstract-platform";
import type { ServerVersionProvider } from "./server-version-provider";

export interface Driver {
  /**
   * Attempts to create a connection with the database.
   *
   * @throws Exception
   */
  connect(params: Record<string, unknown>): Promise<DriverConnection>;

  /**
   * Gets the ExceptionConverter that can be used to convert driver-level exceptions into DBAL exceptions.
   */
  getExceptionConverter(): ExceptionConverter;

  /**
   * Gets the DatabasePlatform instance that provides all the metadata about
   * the platform this driver connects to.
   *
   * @return AbstractPlatform The database platform.
   *
   * @throws PlatformException
   */
  getDatabasePlatform(versionProvider: ServerVersionProvider): AbstractPlatform;
}

export type { DriverConnection, DriverMiddleware };
