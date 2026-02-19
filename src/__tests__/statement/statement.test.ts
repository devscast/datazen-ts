import { describe, expect, it } from "vitest";

import { MixedParameterStyleError } from "../../exception/index";
import { ParameterType } from "../../parameter-type";
import { Result } from "../../result";
import { Statement, type StatementExecutor } from "../../statement";
import type { QueryParameterTypes, QueryParameters } from "../../types";

class SpyExecutor implements StatementExecutor {
  public lastQueryCall:
    | { params: QueryParameters | undefined; sql: string; types: QueryParameterTypes | undefined }
    | undefined;
  public lastStatementCall:
    | { params: QueryParameters | undefined; sql: string; types: QueryParameterTypes | undefined }
    | undefined;

  public async executeQuery(
    sql: string,
    params?: QueryParameters,
    types?: QueryParameterTypes,
  ): Promise<Result> {
    this.lastQueryCall = { params, sql, types };
    return new Result({ rows: [{ ok: true }] });
  }

  public async executeStatement(
    sql: string,
    params?: QueryParameters,
    types?: QueryParameterTypes,
  ): Promise<number> {
    this.lastStatementCall = { params, sql, types };
    return 3;
  }
}

describe("Statement", () => {
  it("returns original SQL", () => {
    const statement = new Statement(new SpyExecutor(), "SELECT 1");
    expect(statement.getSQL()).toBe("SELECT 1");
  });

  it("binds positional values using 1-based index", async () => {
    const executor = new SpyExecutor();
    const statement = new Statement(executor, "SELECT * FROM users WHERE id = ?");

    await statement.bindValue(1, 99, ParameterType.INTEGER).executeQuery();

    expect(executor.lastQueryCall).toEqual({
      params: [99],
      sql: "SELECT * FROM users WHERE id = ?",
      types: [ParameterType.INTEGER],
    });
  });

  it("binds named values with and without colon prefix", async () => {
    const executor = new SpyExecutor();
    const statement = new Statement(executor, "SELECT * FROM users WHERE id = :id");

    await statement
      .bindValue(":id", 10, ParameterType.INTEGER)
      .bindValue("status", "active", ParameterType.STRING)
      .executeQuery();

    expect(executor.lastQueryCall).toEqual({
      params: { id: 10, status: "active" },
      sql: "SELECT * FROM users WHERE id = :id",
      types: { id: ParameterType.INTEGER, status: ParameterType.STRING },
    });
  });

  it("sets positional parameters in bulk", async () => {
    const executor = new SpyExecutor();
    const statement = new Statement(executor, "SELECT * FROM users WHERE id = ? AND role = ?");

    await statement
      .setParameters([5, "admin"], [ParameterType.INTEGER, ParameterType.STRING])
      .executeQuery();

    expect(executor.lastQueryCall).toEqual({
      params: [5, "admin"],
      sql: "SELECT * FROM users WHERE id = ? AND role = ?",
      types: [ParameterType.INTEGER, ParameterType.STRING],
    });
  });

  it("sets named parameters in bulk", async () => {
    const executor = new SpyExecutor();
    const statement = new Statement(executor, "SELECT * FROM users WHERE id = :id");

    await statement
      .setParameters(
        { id: 7, role: "editor" },
        { id: ParameterType.INTEGER, role: ParameterType.STRING },
      )
      .executeQuery();

    expect(executor.lastQueryCall).toEqual({
      params: { id: 7, role: "editor" },
      sql: "SELECT * FROM users WHERE id = :id",
      types: { id: ParameterType.INTEGER, role: ParameterType.STRING },
    });
  });

  it("throws when positional and named bindings are mixed", async () => {
    const statement = new Statement(new SpyExecutor(), "SELECT * FROM users WHERE id = :id");

    statement.bindValue(1, 10).bindValue("id", 10);

    await expect(statement.executeQuery()).rejects.toThrow(MixedParameterStyleError);
  });

  it("executes statement calls through executor", async () => {
    const executor = new SpyExecutor();
    const statement = new Statement(executor, "UPDATE users SET name = ? WHERE id = ?");

    const affectedRows = await statement
      .setParameters(["Alice", 1], [ParameterType.STRING, ParameterType.INTEGER])
      .executeStatement();

    expect(affectedRows).toBe(3);
    expect(executor.lastStatementCall).toEqual({
      params: ["Alice", 1],
      sql: "UPDATE users SET name = ? WHERE id = ?",
      types: [ParameterType.STRING, ParameterType.INTEGER],
    });
  });
});
