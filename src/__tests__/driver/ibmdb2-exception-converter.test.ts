import { describe, expect, it } from "vitest";

import { ExceptionConverter as IBMDB2ExceptionConverter } from "../../driver/api/ibmdb2/exception-converter";
import { ConnectionException } from "../../exception/connection-exception";
import { DriverException } from "../../exception/driver-exception";
import { ForeignKeyConstraintViolationException } from "../../exception/foreign-key-constraint-violation-exception";
import { InvalidFieldNameException } from "../../exception/invalid-field-name-exception";
import { NonUniqueFieldNameException } from "../../exception/non-unique-field-name-exception";
import { NotNullConstraintViolationException } from "../../exception/not-null-constraint-violation-exception";
import { SyntaxErrorException } from "../../exception/syntax-error-exception";
import { TableExistsException } from "../../exception/table-exists-exception";
import { TableNotFoundException } from "../../exception/table-not-found-exception";
import { UniqueConstraintViolationException } from "../../exception/unique-constraint-violation-exception";
import { Query } from "../../query";

describe("IBMDB2 ExceptionConverter", () => {
  it("maps DB2 SQLCODE values to supported DBAL exceptions", () => {
    const converter = new IBMDB2ExceptionConverter();

    expect(
      converter.convert(Object.assign(new Error("SQL0104N syntax"), { sqlcode: -104 }), {
        operation: "executeQuery",
      }),
    ).toBeInstanceOf(SyntaxErrorException);

    expect(
      converter.convert(Object.assign(new Error("SQL0203N column ambiguous"), { sqlcode: -203 }), {
        operation: "executeQuery",
      }),
    ).toBeInstanceOf(NonUniqueFieldNameException);

    expect(
      converter.convert(Object.assign(new Error("SQL0204N table not found"), { sqlcode: -204 }), {
        operation: "executeQuery",
      }),
    ).toBeInstanceOf(TableNotFoundException);

    expect(
      converter.convert(Object.assign(new Error("SQL0206N column not valid"), { sqlcode: -206 }), {
        operation: "executeQuery",
      }),
    ).toBeInstanceOf(InvalidFieldNameException);

    expect(
      converter.convert(Object.assign(new Error("SQL0407N null not allowed"), { sqlcode: -407 }), {
        operation: "executeStatement",
      }),
    ).toBeInstanceOf(NotNullConstraintViolationException);

    expect(
      converter.convert(Object.assign(new Error("SQL0530N foreign key"), { sqlcode: -530 }), {
        operation: "executeStatement",
      }),
    ).toBeInstanceOf(ForeignKeyConstraintViolationException);

    expect(
      converter.convert(Object.assign(new Error("SQL0601N object exists"), { sqlcode: -601 }), {
        operation: "executeStatement",
      }),
    ).toBeInstanceOf(TableExistsException);

    expect(
      converter.convert(Object.assign(new Error("SQL0803N duplicate key"), { sqlcode: -803 }), {
        operation: "executeStatement",
      }),
    ).toBeInstanceOf(UniqueConstraintViolationException);

    expect(
      converter.convert(
        Object.assign(new Error("SQL30082N connection failed"), { sqlcode: -30082 }),
        {
          operation: "connect",
        },
      ),
    ).toBeInstanceOf(ConnectionException);
  });

  it("captures query metadata and sqlstate", () => {
    const converter = new IBMDB2ExceptionConverter();
    const query = new Query("SELECT * FROM users WHERE id = ?", [7]);
    const error = Object.assign(new Error("SQL0204N USERS not found. SQLSTATE=42704"), {
      sqlcode: "-204",
    });

    const converted = converter.convert(error, { operation: "executeQuery", query });

    expect(converted).toBeInstanceOf(TableNotFoundException);
    expect(converted.code).toBe(-204);
    expect(converted.sqlState).toBe("42704");
    expect(converted.sql).toBe("SELECT * FROM users WHERE id = ?");
    expect(converted.parameters).toEqual([7]);
    expect(converted.driverName).toBe("ibmdb2");
  });

  it("falls back to DriverException for unknown codes", () => {
    const converter = new IBMDB2ExceptionConverter();
    const error = Object.assign(new Error("Unknown DB2 driver failure"), { code: "SOMETHING" });

    const converted = converter.convert(error, { operation: "executeQuery" });

    expect(converted).toBeInstanceOf(DriverException);
    expect(converted).not.toBeInstanceOf(ConnectionException);
    expect(converted.code).toBe("SOMETHING");
  });
});
