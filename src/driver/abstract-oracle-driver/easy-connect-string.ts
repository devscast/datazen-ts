type EasyConnectParams = Record<string, unknown> | unknown[];

/**
 * Represents an Oracle Easy Connect string.
 *
 * @link https://docs.oracle.com/database/121/NETAG/naming.htm
 */
export class EasyConnectString {
  private constructor(private readonly value: string) {}

  public toString(): string {
    return this.value;
  }

  public static fromArray(params: Record<string, unknown>): EasyConnectString {
    return new EasyConnectString(EasyConnectString.renderParams(params));
  }

  public static fromConnectionParameters(params: Record<string, unknown>): EasyConnectString {
    const connectString = params.connectstring;
    if (EasyConnectString.isSet(connectString)) {
      return new EasyConnectString(EasyConnectString.phpStringCast(connectString));
    }

    const host = params.host;
    if (!EasyConnectString.isSet(host)) {
      const dbname = params.dbname;

      return new EasyConnectString(
        EasyConnectString.isSet(dbname) ? EasyConnectString.phpStringCast(dbname) : "",
      );
    }

    const connectData: Record<string, unknown> = {};

    if (EasyConnectString.isSet(params.service)) {
      EasyConnectString.emitServiceParameterDeprecation();
    }

    if (EasyConnectString.isSet(params.servicename) || EasyConnectString.isSet(params.dbname)) {
      let serviceKey = "SID";

      if (EasyConnectString.isSet(params.service) || EasyConnectString.isSet(params.servicename)) {
        serviceKey = "SERVICE_NAME";
      }

      const serviceName = EasyConnectString.isSet(params.servicename)
        ? params.servicename
        : params.dbname;

      connectData[serviceKey] = serviceName;
    }

    if (EasyConnectString.isSet(params.instancename)) {
      connectData.INSTANCE_NAME = params.instancename;
    }

    if (!EasyConnectString.isPhpEmpty(params.pooled)) {
      connectData.SERVER = "POOLED";
    }

    const driverOptions = EasyConnectString.asRecord(params.driverOptions);
    const protocol = EasyConnectString.isSet(driverOptions?.protocol)
      ? driverOptions?.protocol
      : "TCP";

    const port = EasyConnectString.isSet(params.port) ? params.port : 1521;
    const address: Record<string, unknown> = {};
    address.PROTOCOL = protocol;
    address.HOST = host;
    address.PORT = port;

    return EasyConnectString.fromArray({
      DESCRIPTION: {
        ADDRESS: address,
        CONNECT_DATA: connectData,
      },
    });
  }

  private static renderParams(params: EasyConnectParams): string {
    const chunks: string[] = [];

    for (const [key, rawValue] of Object.entries(params)) {
      const renderedValue = EasyConnectString.renderValue(rawValue);

      if (renderedValue === "") {
        continue;
      }

      chunks.push(`(${key}=${renderedValue})`);
    }

    return chunks.join("");
  }

  private static renderValue(value: unknown): string {
    if (Array.isArray(value) || EasyConnectString.isPlainObject(value)) {
      return EasyConnectString.renderParams(value as EasyConnectParams);
    }

    return EasyConnectString.phpStringCast(value);
  }

  private static emitServiceParameterDeprecation(): void {
    process.emitWarning(
      'Using the "service" parameter to indicate that the value of the "dbname" parameter is the service name is deprecated. Use the "servicename" parameter instead.',
      "DeprecationWarning",
    );
  }

  private static asRecord(value: unknown): Record<string, unknown> | null {
    if (!EasyConnectString.isPlainObject(value)) {
      return null;
    }

    return value;
  }

  private static isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== "object" || value === null) {
      return false;
    }

    const prototype = Object.getPrototypeOf(value);

    return prototype === Object.prototype || prototype === null;
  }

  private static isSet(value: unknown): boolean {
    return value !== undefined && value !== null;
  }

  private static isPhpEmpty(value: unknown): boolean {
    if (value === undefined || value === null) {
      return true;
    }

    if (value === false || value === 0 || value === "" || value === "0") {
      return true;
    }

    if (Array.isArray(value)) {
      return value.length === 0;
    }

    if (EasyConnectString.isPlainObject(value)) {
      return Object.keys(value).length === 0;
    }

    return false;
  }

  private static phpStringCast(value: unknown): string {
    if (value === undefined || value === null) {
      return "";
    }

    if (value === true) {
      return "1";
    }

    if (value === false) {
      return "";
    }

    return String(value);
  }
}
