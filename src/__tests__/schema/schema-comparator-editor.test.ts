import { describe, expect, it } from "vitest";

import { Comparator } from "../../schema/comparator";
import { ComparatorConfig } from "../../schema/comparator-config";
import { Table } from "../../schema/table";
import { UniqueConstraint } from "../../schema/unique-constraint";
import { Types } from "../../types/types";

describe("Schema comparator and editors", () => {
  it("creates tables through TableEditor and compares schema changes", () => {
    const baseUsers = new Table("users");
    baseUsers.addColumn("id", Types.INTEGER);

    const modifiedUsers = new Table("users");
    modifiedUsers.addColumn("id", Types.INTEGER, { autoincrement: true });
    modifiedUsers.addColumn("email", Types.STRING, { length: 190 });

    const comparator = new Comparator(new ComparatorConfig({ detectColumnRenames: true }));
    const tableDiff = comparator.compareTables(baseUsers, modifiedUsers);

    expect(tableDiff).not.toBeNull();
    expect(tableDiff?.addedColumns.map((column) => column.getName())).toContain("email");
  });

  it("supports unique constraint editing", () => {
    const unique = new UniqueConstraint("uniq_users_email", ["email"], ["clustered"]);

    const edited = unique.edit().setName("uniq_users_email_v2").create();

    expect(edited.getObjectName()).toBe("uniq_users_email_v2");
    expect(edited.isClustered()).toBe(true);
  });
});
