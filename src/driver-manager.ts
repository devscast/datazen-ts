import { Configuration } from "./configuration";
import { Connection } from "./connection";
import type { Driver } from "./driver";
import { MSSQLDriver } from "./driver/mssql/driver";
import { MySQL2Driver } from "./driver/mysql2/driver";
import { DriverRequiredException, UnknownDriverException } from "./exception/index";

export type DriverName = "mysql2" | "mssql";

export interface ConnectionParams extends Record<string, unknown> {
  driver?: DriverName;
  driverClass?: new () => Driver;
  driverInstance?: Driver;
}

export class DriverManager {
  private static readonly DRIVER_MAP: Record<DriverName, new () => Driver> = {
    mssql: MSSQLDriver,
    mysql2: MySQL2Driver,
  };

  public static getConnection(
    params: ConnectionParams,
    configuration: Configuration = new Configuration(),
  ): Connection {
    const driver = DriverManager.createDriver(params);

    let wrappedDriver = driver;
    for (const middleware of configuration.getMiddlewares()) {
      wrappedDriver = middleware.wrap(wrappedDriver);
    }

    return new Connection(params, wrappedDriver, configuration);
  }

  public static getAvailableDrivers(): DriverName[] {
    return Object.keys(DriverManager.DRIVER_MAP) as DriverName[];
  }

  private static createDriver(params: ConnectionParams): Driver {
    if (params.driverInstance !== undefined) {
      return params.driverInstance;
    }

    if (params.driverClass !== undefined) {
      return new params.driverClass();
    }

    if (params.driver === undefined) {
      throw new DriverRequiredException();
    }

    const DriverClass = DriverManager.DRIVER_MAP[params.driver];
    if (DriverClass === undefined) {
      throw new UnknownDriverException(params.driver, Object.keys(DriverManager.DRIVER_MAP));
    }

    return new DriverClass();
  }
}
