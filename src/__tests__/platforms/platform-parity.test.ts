import { describe, expect, it } from "vitest";

import { AbstractPlatform } from "../../platforms/abstract-platform";
import { DB2Platform } from "../../platforms/db2-platform";
import { MySQLPlatform } from "../../platforms/mysql-platform";
import { OraclePlatform } from "../../platforms/oracle-platform";
import { SQLServerPlatform } from "../../platforms/sql-server-platform";
import { TrimMode } from "../../platforms/trim-mode";
import { TransactionIsolationLevel } from "../../transaction-isolation-level";
import { Types } from "../../types/types";

class DummyPlatform extends AbstractPlatform {
  public getLocateExpression(string: string, substring: string, start?: string | null): string {
    if (start === undefined || start === null) {
      return `LOCATE(${substring}, ${string})`;
    }

    return `LOCATE(${substring}, ${string}, ${start})`;
  }

  public getDateDiffExpression(date1: string, date2: string): string {
    return `DATEDIFF(${date1}, ${date2})`;
  }

  public getSetTransactionIsolationSQL(level: TransactionIsolationLevel): string {
    return `SET TRANSACTION ISOLATION LEVEL ${level}`;
  }
}

describe("Platform parity extensions", () => {
  it("quotes identifiers with dot notation and escaping", () => {
    const platform = new DummyPlatform();

    expect(platform.quoteIdentifier('user."name"')).toBe('"user"."""name"""');
  });

  it("rejects negative offsets when modifying limit query", () => {
    const platform = new DummyPlatform();

    expect(() => platform.modifyLimitQuery("SELECT 1", 10, -1)).toThrowError(
      "Offset must be a positive integer or zero, -1 given.",
    );
  });

  it("escapes LIKE wildcard characters", () => {
    const platform = new DummyPlatform();
    const sqlServerPlatform = new SQLServerPlatform();

    expect(platform.escapeStringForLike("100%_done!", "!")).toBe("100!%!_done!!");
    expect(sqlServerPlatform.escapeStringForLike("[x]%_", "!")).toBe("![x]!%!_");
  });

  it("handles base trim expression modes", () => {
    const platform = new DummyPlatform();

    expect(platform.getTrimExpression("name")).toBe("TRIM(name)");
    expect(platform.getTrimExpression("name", TrimMode.LEADING, "'x'")).toBe(
      "TRIM(LEADING 'x' FROM name)",
    );
    expect(platform.getTrimExpression("name", TrimMode.TRAILING, "'x'")).toBe(
      "TRIM(TRAILING 'x' FROM name)",
    );
  });

  it("converts booleans according to base and sqlserver rules", () => {
    const base = new DummyPlatform();
    const sqlServer = new SQLServerPlatform();

    expect(base.convertBooleans([true, false, "x"])).toEqual([1, 0, "x"]);
    expect(base.convertFromBoolean(null)).toBeNull();
    expect(base.convertFromBoolean(1)).toBe(true);

    expect(sqlServer.convertBooleans([true, false, 2, 0, "x"])).toEqual([1, 0, 1, 0, "x"]);
  });

  it("applies SQL Server pagination ORDER BY fallback rules", () => {
    const platform = new SQLServerPlatform();

    expect(platform.modifyLimitQuery("SELECT id FROM users", 5, 2)).toBe(
      "SELECT id FROM users ORDER BY (SELECT 0) OFFSET 2 ROWS FETCH NEXT 5 ROWS ONLY",
    );
    expect(platform.modifyLimitQuery("SELECT DISTINCT id FROM users", 5, 2)).toBe(
      "SELECT DISTINCT id FROM users ORDER BY 1 OFFSET 2 ROWS FETCH NEXT 5 ROWS ONLY",
    );
    expect(platform.modifyLimitQuery("SELECT id FROM users ORDER BY id DESC", 5, 0)).toBe(
      "SELECT id FROM users ORDER BY id DESC OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY",
    );
  });

  it("applies SQL Server lock hints and identifier quoting", () => {
    const platform = new SQLServerPlatform();

    expect(platform.appendLockHint("users u", "pessimistic_read")).toBe(
      "users u WITH (HOLDLOCK, ROWLOCK)",
    );
    expect(platform.appendLockHint("users u", "pessimistic_write")).toBe(
      "users u WITH (UPDLOCK, ROWLOCK)",
    );
    expect(platform.quoteSingleIdentifier("a]b")).toBe("[a]]b]");
  });

  it("maps Oracle date arithmetic and savepoint release semantics", () => {
    const platform = new OraclePlatform();

    expect(platform.getDateAddQuarterExpression("created_at", "2")).toBe(
      "ADD_MONTHS(created_at, +2 * 3)",
    );
    expect(platform.getDateSubYearExpression("created_at", "1")).toBe(
      "ADD_MONTHS(created_at, -1 * 12)",
    );
    expect(platform.supportsReleaseSavepoints()).toBe(false);
    expect(platform.releaseSavePoint("sp1")).toBe("");
  });

  it("maps DB2 date arithmetic and select syntax", () => {
    const platform = new DB2Platform();

    expect(platform.getDateAddWeeksExpression("created_at", "3")).toBe("created_at + 3 * 7 DAY");
    expect(platform.getDateSubQuarterExpression("created_at", "2")).toBe(
      "created_at - 2 * 3 MONTH",
    );
    expect(platform.getDummySelectSQL("1")).toBe("SELECT 1 FROM sysibm.sysdummy1");
    expect(platform.supportsSavepoints()).toBe(false);
  });

  it("keeps MySQL-specific behavior for concat and locate", () => {
    const platform = new MySQLPlatform();

    expect(platform.getConcatExpression("a", "b", "c")).toBe("CONCAT(a, b, c)");
    expect(platform.getLocateExpression("name", "'x'")).toBe("LOCATE('x', name)");
    expect(platform.getLocateExpression("name", "'x'", "2")).toBe("LOCATE('x', name, 2)");
  });

  it("exposes Datazen Type mappings per platform", () => {
    const mysql = new MySQLPlatform();
    const sqlServer = new SQLServerPlatform();
    const oracle = new OraclePlatform();
    const db2 = new DB2Platform();

    expect(mysql.getDatazenTypeMapping("varchar")).toBe(Types.STRING);
    expect(sqlServer.getDatazenTypeMapping("uniqueidentifier")).toBe(Types.GUID);
    expect(oracle.getDatazenTypeMapping("varchar2")).toBe(Types.STRING);
    expect(db2.getDatazenTypeMapping("timestamp")).toBe(Types.DATETIME_MUTABLE);
  });

  it("supports checking and registering Datazen Type mappings", () => {
    const platform = new MySQLPlatform();

    expect(platform.hasDatazenTypeMappingFor("varchar")).toBe(true);
    expect(platform.hasDatazenTypeMappingFor("custom_json")).toBe(false);

    platform.registerDatazenTypeMapping("custom_json", Types.JSON);
    expect(platform.hasDatazenTypeMappingFor("custom_json")).toBe(true);
    expect(platform.getDatazenTypeMapping("custom_json")).toBe(Types.JSON);
  });

  it("throws for unknown database type mappings", () => {
    const platform = new MySQLPlatform();

    expect(() => platform.getDatazenTypeMapping("definitely_unknown_type")).toThrowError(
      'Unknown database type "definitely_unknown_type" requested',
    );
  });
});
