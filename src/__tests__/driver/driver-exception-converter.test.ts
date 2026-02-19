import { describe, expect, it } from "vitest";

import { ExceptionConverter as MySQLExceptionConverter } from "../../driver/api/mysql/exception-converter";
import { ExceptionConverter as SQLSrvExceptionConverter } from "../../driver/api/sqlsrv/exception-converter";
import {
  ConnectionException,
  DeadlockException,
  DriverException,
  ForeignKeyConstraintViolationException,
  NotNullConstraintViolationException,
  SqlSyntaxException,
  UniqueConstraintViolationException,
} from "../../exception/index";
import { Query } from "../../query";

describe("Driver exception converters", () => {
  it("maps mysql duplicate key to UniqueConstraintViolationException", () => {
    const converter = new MySQLExceptionConverter();
    const error = Object.assign(new Error("Duplicate entry '1' for key 'PRIMARY'"), {
      code: "ER_DUP_ENTRY",
      errno: 1062,
      sqlState: "23000",
    });

    const converted = converter.convert(error, {
      operation: "executeStatement",
      query: new Query("INSERT INTO users (id) VALUES (?)", [1]),
    });

    expect(converted).toBeInstanceOf(UniqueConstraintViolationException);
    expect(converted.code).toBe(1062);
    expect(converted.sqlState).toBe("23000");
    expect(converted.sql).toBe("INSERT INTO users (id) VALUES (?)");
    expect(converted.parameters).toEqual([1]);
  });

  it("maps mysql deadlock error code", () => {
    const converter = new MySQLExceptionConverter();
    const error = Object.assign(new Error("Deadlock found when trying to get lock"), {
      errno: 1213,
    });

    const converted = converter.convert(error, { operation: "executeQuery" });

    expect(converted).toBeInstanceOf(DeadlockException);
    expect(converted.operation).toBe("executeQuery");
  });

  it("maps mysql connection failures from string codes", () => {
    const converter = new MySQLExceptionConverter();
    const error = Object.assign(new Error("connect ECONNREFUSED"), {
      code: "ECONNREFUSED",
    });

    const converted = converter.convert(error, { operation: "connect" });

    expect(converted).toBeInstanceOf(ConnectionException);
    expect(converted.code).toBe("ECONNREFUSED");
  });

  it("maps mssql not null constraint violations", () => {
    const converter = new SQLSrvExceptionConverter();
    const error = Object.assign(new Error("Cannot insert the value NULL"), {
      code: "EREQUEST",
      number: 515,
    });

    const converted = converter.convert(error, { operation: "executeStatement" });

    expect(converted).toBeInstanceOf(NotNullConstraintViolationException);
    expect(converted.code).toBe(515);
  });

  it("maps mssql foreign key violations", () => {
    const converter = new SQLSrvExceptionConverter();
    const error = Object.assign(new Error("The DELETE statement conflicted with the REFERENCE"), {
      number: 547,
    });

    const converted = converter.convert(error, { operation: "executeStatement" });

    expect(converted).toBeInstanceOf(ForeignKeyConstraintViolationException);
  });

  it("maps mssql syntax and unique violations", () => {
    const converter = new SQLSrvExceptionConverter();
    const syntaxError = Object.assign(new Error("Incorrect syntax near 'FROM'"), { number: 102 });
    const uniqueError = Object.assign(new Error("Violation of UNIQUE KEY constraint"), {
      number: 2627,
    });

    expect(converter.convert(syntaxError, { operation: "executeQuery" })).toBeInstanceOf(
      SqlSyntaxException,
    );
    expect(converter.convert(uniqueError, { operation: "executeStatement" })).toBeInstanceOf(
      UniqueConstraintViolationException,
    );
  });

  it("falls back to DriverException for unmapped driver exceptions", () => {
    const converter = new SQLSrvExceptionConverter();
    const error = Object.assign(new Error("Unknown driver failure"), { code: "EREQUEST" });

    const converted = converter.convert(error, { operation: "executeQuery" });

    expect(converted).toBeInstanceOf(DriverException);
    expect(converted).not.toBeInstanceOf(ConnectionException);
  });
});
