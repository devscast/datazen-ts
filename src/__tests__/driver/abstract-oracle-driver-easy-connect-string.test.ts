import { describe, expect, it, vi } from "vitest";

import { EasyConnectString } from "../../driver/abstract-oracle-driver/easy-connect-string";

describe("EasyConnectString", () => {
  it("renders nested array parameters", () => {
    const easyConnect = EasyConnectString.fromArray({
      DESCRIPTION: {
        ADDRESS: {
          PROTOCOL: "TCP",
          HOST: "db.example.test",
          PORT: 1521,
        },
        CONNECT_DATA: {
          SID: "XE",
          EMPTY_VALUE: null,
          ENABLED: true,
          DISABLED: false,
        },
      },
    });

    expect(easyConnect.toString()).toBe(
      "(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=db.example.test)(PORT=1521))(CONNECT_DATA=(SID=XE)(ENABLED=1)))",
    );
  });

  it("uses connectstring when provided", () => {
    const easyConnect = EasyConnectString.fromConnectionParameters({
      connectstring: "(DESCRIPTION=(ADDRESS=(HOST=override)))",
      host: "ignored",
      dbname: "ignored",
    });

    expect(easyConnect.toString()).toBe("(DESCRIPTION=(ADDRESS=(HOST=override)))");
  });

  it("falls back to dbname when host is missing", () => {
    expect(EasyConnectString.fromConnectionParameters({ dbname: "XE" }).toString()).toBe("XE");
    expect(EasyConnectString.fromConnectionParameters({}).toString()).toBe("");
  });

  it("builds an oracle descriptor using SID by default", () => {
    const easyConnect = EasyConnectString.fromConnectionParameters({
      host: "oracle.local",
      dbname: "ORCL",
    });

    expect(easyConnect.toString()).toBe(
      "(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=oracle.local)(PORT=1521))(CONNECT_DATA=(SID=ORCL)))",
    );
  });

  it("uses SERVICE_NAME mode and emits a deprecation warning for service", () => {
    const emitWarning = vi.spyOn(process, "emitWarning").mockImplementation(() => undefined);

    const easyConnect = EasyConnectString.fromConnectionParameters({
      host: "oracle.local",
      dbname: "ORCLPDB1",
      service: true,
      instancename: "ORCL1",
      pooled: true,
      port: 2484,
      driverOptions: {
        protocol: "TCPS",
      },
    });

    expect(easyConnect.toString()).toBe(
      "(DESCRIPTION=(ADDRESS=(PROTOCOL=TCPS)(HOST=oracle.local)(PORT=2484))(CONNECT_DATA=(SERVICE_NAME=ORCLPDB1)(INSTANCE_NAME=ORCL1)(SERVER=POOLED)))",
    );
    expect(emitWarning).toHaveBeenCalledTimes(1);
    expect(emitWarning).toHaveBeenCalledWith(
      expect.stringContaining('"service" parameter'),
      "DeprecationWarning",
    );

    emitWarning.mockRestore();
  });
});
