import { describe, expect, it } from "vitest";

import { InvalidUniqueConstraintDefinition } from "../../schema/exception/invalid-unique-constraint-definition";
import { UniqueConstraint } from "../../schema/unique-constraint";

describe("Schema/UniqueConstraint (Doctrine parity, supported scenarios)", () => {
  it("returns a non-null object name when named", () => {
    const uniqueConstraint = UniqueConstraint.editor()
      .setName("uq_user_id")
      .setColumnNames("user_id")
      .create();

    expect(uniqueConstraint.getObjectName()).toBe("uq_user_id");
  });

  it("returns null object name when unnamed", () => {
    const uniqueConstraint = UniqueConstraint.editor().setUnquotedColumnNames("user_id").create();

    expect(uniqueConstraint.getObjectName()).toBeNull();
  });

  it("returns column names", () => {
    const uniqueConstraint = new UniqueConstraint("", ["user_id"]);

    expect(uniqueConstraint.getColumnNames()).toEqual(["user_id"]);
  });

  it.each([
    [["clustered"], true],
    [[], false],
  ])("detects clustered flags for %j", (flags, expected) => {
    const uniqueConstraint = new UniqueConstraint("", ["user_id"], flags);

    expect(uniqueConstraint.isClustered()).toBe(expected);
  });

  it("throws on empty column names", () => {
    expect(() => new UniqueConstraint("", [])).toThrow(InvalidUniqueConstraintDefinition);
  });

  it.skip(
    "Doctrine deprecation/invalid-state constructor validation cases are not fully modeled in Node",
  );
});
