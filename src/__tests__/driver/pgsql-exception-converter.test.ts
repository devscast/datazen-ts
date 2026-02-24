import { describe, expect, it } from "vitest";

import { ExceptionConverter as PgSQLExceptionConverter } from "../../driver/api/pgsql/exception-converter";
import { ConnectionException } from "../../exception/connection-exception";
import { ConnectionLost } from "../../exception/connection-lost";
import { DriverException } from "../../exception/driver-exception";
import { ForeignKeyConstraintViolationException } from "../../exception/foreign-key-constraint-violation-exception";
import { TableNotFoundException } from "../../exception/table-not-found-exception";
import { Query } from "../../query";

describe("PgSQL ExceptionConverter", () => {
  it("captures query metadata and sqlState from sqlState field when code is numeric", () => {
    const converter = new PgSQLExceptionConverter();
    const query = new Query("SELECT * FROM missing_table WHERE id = $1", [7]);
    const error = Object.assign(new Error("relation does not exist"), {
      code: 999,
      sqlState: "42P01",
    });

    const converted = converter.convert(error, { operation: "executeQuery", query });

    expect(converted).toBeInstanceOf(TableNotFoundException);
    expect(converted.code).toBe(999);
    expect(converted.sqlState).toBe("42P01");
    expect(converted.sql).toBe("SELECT * FROM missing_table WHERE id = $1");
    expect(converted.parameters).toEqual([7]);
    expect(converted.driverName).toBe("pg");
  });

  it("maps 0A000 truncate errors to foreign key violations and non-truncate 0A000 to fallback", () => {
    const converter = new PgSQLExceptionConverter();

    const truncate = converter.convert(
      Object.assign(new Error("cannot TRUNCATE a table referenced in a foreign key constraint"), {
        code: "0A000",
      }),
      { operation: "executeStatement" },
    );

    const nonTruncate = converter.convert(
      Object.assign(new Error("feature not supported"), {
        code: "0A000",
      }),
      { operation: "executeStatement" },
    );

    expect(truncate).toBeInstanceOf(ForeignKeyConstraintViolationException);
    expect(nonTruncate).toBeInstanceOf(DriverException);
  });

  it("prefers ConnectionLost for terminating connection messages before generic connection heuristics", () => {
    const converter = new PgSQLExceptionConverter();
    const error = Object.assign(
      new Error("terminating connection due to crash of another server process"),
      {
        code: "57P02",
      },
    );

    const converted = converter.convert(error, { operation: "executeQuery" });

    expect(converted).toBeInstanceOf(ConnectionLost);
    expect(converted.constructor).toBe(ConnectionLost);
    expect(converted.sqlState).toBe("57P02");
  });

  it("maps ECONN* and ETIMEDOUT string codes to ConnectionException", () => {
    const converter = new PgSQLExceptionConverter();

    const connReset = converter.convert(
      Object.assign(new Error("connect ECONNRESET"), { code: "ECONNRESET" }),
      { operation: "connect" },
    );
    const timedOut = converter.convert(
      Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" }),
      { operation: "connect" },
    );

    expect(connReset).toBeInstanceOf(ConnectionException);
    expect(connReset.code).toBe("ECONNRESET");
    expect(timedOut).toBeInstanceOf(ConnectionException);
    expect(timedOut.code).toBe("ETIMEDOUT");
  });
});
