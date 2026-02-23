import { describe, expect, it } from "vitest";

import { ExceptionConverter as OCIExceptionConverter } from "../../driver/api/oci/exception-converter";
import { ConnectionException } from "../../exception/connection-exception";
import { DatabaseDoesNotExist } from "../../exception/database-does-not-exist";
import { DatabaseObjectNotFoundException } from "../../exception/database-object-not-found-exception";
import { ForeignKeyConstraintViolationException } from "../../exception/foreign-key-constraint-violation-exception";
import { InvalidFieldNameException } from "../../exception/invalid-field-name-exception";
import { NonUniqueFieldNameException } from "../../exception/non-unique-field-name-exception";
import { NotNullConstraintViolationException } from "../../exception/not-null-constraint-violation-exception";
import { SyntaxErrorException } from "../../exception/syntax-error-exception";
import { TableExistsException } from "../../exception/table-exists-exception";
import { TableNotFoundException } from "../../exception/table-not-found-exception";
import { UniqueConstraintViolationException } from "../../exception/unique-constraint-violation-exception";
import { Query } from "../../query";

describe("OCI ExceptionConverter", () => {
  it("maps Oracle codes to DBAL exceptions", () => {
    const converter = new OCIExceptionConverter();

    expect(
      converter.convert(
        Object.assign(new Error("ORA-00001: unique constraint violated"), { code: 1 }),
        {
          operation: "executeStatement",
        },
      ),
    ).toBeInstanceOf(UniqueConstraintViolationException);

    expect(
      converter.convert(Object.assign(new Error("ORA-00904: invalid identifier"), { code: 904 }), {
        operation: "executeQuery",
      }),
    ).toBeInstanceOf(InvalidFieldNameException);

    expect(
      converter.convert(
        Object.assign(new Error("ORA-00918: column ambiguously defined"), { errorNum: 918 }),
        {
          operation: "executeQuery",
        },
      ),
    ).toBeInstanceOf(NonUniqueFieldNameException);

    expect(
      converter.convert(
        Object.assign(new Error("ORA-00923: FROM keyword not found"), { errorNum: 923 }),
        {
          operation: "executeQuery",
        },
      ),
    ).toBeInstanceOf(SyntaxErrorException);

    expect(
      converter.convert(
        Object.assign(new Error("ORA-00942: table or view does not exist"), { code: 942 }),
        {
          operation: "executeQuery",
        },
      ),
    ).toBeInstanceOf(TableNotFoundException);

    expect(
      converter.convert(
        Object.assign(new Error("ORA-00955: name is already used"), { errorNum: 955 }),
        {
          operation: "executeStatement",
        },
      ),
    ).toBeInstanceOf(TableExistsException);

    expect(
      converter.convert(
        Object.assign(new Error("ORA-01400: cannot insert NULL"), { code: "ORA-01400" }),
        {
          operation: "executeStatement",
        },
      ),
    ).toBeInstanceOf(NotNullConstraintViolationException);

    expect(
      converter.convert(
        Object.assign(new Error("ORA-01918: user does not exist"), { errorNum: 1918 }),
        {
          operation: "connect",
        },
      ),
    ).toBeInstanceOf(DatabaseDoesNotExist);

    expect(
      converter.convert(
        Object.assign(new Error("ORA-02291: integrity constraint violated"), { errorNum: 2291 }),
        {
          operation: "executeStatement",
        },
      ),
    ).toBeInstanceOf(ForeignKeyConstraintViolationException);

    expect(
      converter.convert(
        Object.assign(new Error("ORA-02289: sequence does not exist"), { errorNum: 2289 }),
        {
          operation: "executeQuery",
        },
      ),
    ).toBeInstanceOf(DatabaseObjectNotFoundException);

    expect(
      converter.convert(
        Object.assign(new Error("ORA-01017: invalid username/password"), { errorNum: 1017 }),
        {
          operation: "connect",
        },
      ),
    ).toBeInstanceOf(ConnectionException);
  });

  it("captures query metadata and SQLSTATE for mapped Oracle errors", () => {
    const converter = new OCIExceptionConverter();
    const query = new Query("SELECT missing_col FROM users", []);
    const error = Object.assign(new Error("SQLSTATE[HY000]: ORA-00904: invalid identifier"), {
      code: "ORA-00904",
    });

    const converted = converter.convert(error, { operation: "executeQuery", query });

    expect(converted).toBeInstanceOf(InvalidFieldNameException);
    expect(converted.code).toBe(904);
    expect(converted.sqlState).toBe("HY000");
    expect(converted.sql).toBe("SELECT missing_col FROM users");
    expect(converted.driverName).toBe("oci8");
  });

  it("unwraps ORA-02091 and converts the nested Oracle error", () => {
    const converter = new OCIExceptionConverter();
    const error = new Error(
      "ORA-02091: transaction rolled back\nORA-00001: unique constraint (APP.USERS_PK) violated",
    );
    const query = new Query("COMMIT");

    const converted = converter.convert(Object.assign(error, { errorNum: 2091 }), {
      operation: "commit",
      query,
    });

    expect(converted).toBeInstanceOf(UniqueConstraintViolationException);
    expect(converted.code).toBe(1);
    expect(converted.operation).toBe("commit");
    expect(converted.sql).toBe("COMMIT");
  });
});
