import { describe, expect, it } from "vitest";

import type { Connection } from "../../connection";
import { NonUniqueAlias } from "../../query/exception/non-unique-alias";
import { UnknownAlias } from "../../query/exception/unknown-alias";
import { CompositeExpression } from "../../query/expression/composite-expression";
import { ExpressionBuilder } from "../../query/expression/expression-builder";
import { ForUpdate } from "../../query/for-update";
import { ConflictResolutionMode } from "../../query/for-update/conflict-resolution-mode";
import { Join } from "../../query/join";
import { Limit } from "../../query/limit";
import { QueryException } from "../../query/query-exception";
import { SelectQuery } from "../../query/select-query";
import { Union } from "../../query/union";
import { UnionQuery } from "../../query/union-query";

describe("Query API surface parity", () => {
  it("adds SelectQuery getters and distinct flag accessor", () => {
    const limit = new Limit(10, 5);
    const forUpdate = new ForUpdate(ConflictResolutionMode.SKIP_LOCKED);
    const query = new SelectQuery(
      true,
      ["u.id", "u.email"],
      ["users u"],
      "u.active = 1",
      ["u.role_id"],
      "COUNT(*) > 1",
      ["u.id DESC"],
      limit,
      forUpdate,
    );

    expect(query.isDistinct()).toBe(true);
    expect(query.getColumns()).toEqual(["u.id", "u.email"]);
    expect(query.getFrom()).toEqual(["users u"]);
    expect(query.getWhere()).toBe("u.active = 1");
    expect(query.getGroupBy()).toEqual(["u.role_id"]);
    expect(query.getHaving()).toBe("COUNT(*) > 1");
    expect(query.getOrderBy()).toEqual(["u.id DESC"]);
    expect(query.getLimit()).toBe(limit);
    expect(query.getForUpdate()).toBe(forUpdate);
  });

  it("adds UnionQuery getters", () => {
    const limit = new Limit(25, 0);
    const unionA = new Union("SELECT 1");
    const unionB = new Union("SELECT 2");
    const query = new UnionQuery([unionA, unionB], ["id ASC"], limit);

    expect(query.getUnionParts()).toEqual([unionA, unionB]);
    expect(query.getOrderBy()).toEqual(["id ASC"]);
    expect(query.getLimit()).toBe(limit);
  });

  it("adds Join factories and ForUpdate conflict resolution getter", () => {
    const inner = Join.inner("phones", "p", "p.user_id = u.id");
    const left = Join.left("roles", "r", null);
    const right = Join.right("profiles", "pr", "pr.user_id = u.id");

    expect(inner.type).toBe("INNER");
    expect(left.type).toBe("LEFT");
    expect(right.type).toBe("RIGHT");

    const forUpdate = new ForUpdate(ConflictResolutionMode.ORDINARY);
    expect(forUpdate.getConflictResolutionMode()).toBe(ConflictResolutionMode.ORDINARY);
  });

  it("adds CompositeExpression and ExpressionBuilder public helpers", async () => {
    const andExpr = CompositeExpression.and("u.active = 1", "u.deleted_at IS NULL");
    const orExpr = CompositeExpression.or("u.role = 'admin'", "u.role = 'owner'");

    expect(andExpr.getType()).toBe("AND");
    expect(orExpr.getType()).toBe("OR");

    const connection = {
      quote: async (value: string) => `'${value}'`,
    } as unknown as Connection;
    const expr = new ExpressionBuilder(connection);

    expect(expr.and("a = 1", "b = 2").toString()).toContain("AND");
    expect(await expr.literal("abc")).toBe("'abc'");
  });

  it("adds query exception factory aliases", () => {
    const nonUnique = NonUniqueAlias.new("u", ["u", "a"]);
    const unknown = UnknownAlias.new("x", ["u", "a"]);

    expect(nonUnique).toBeInstanceOf(QueryException);
    expect(nonUnique.message).toContain('"u"');
    expect(unknown).toBeInstanceOf(QueryException);
    expect(unknown.message).toContain('"x"');
  });
});
