import { describe, expect, it } from "vitest";

import { MySQLPlatform } from "../../../platforms/mysql-platform";
import { Comparator } from "../../../schema/comparator";
import { Table } from "../../../schema/table";
import { Types } from "../../../types/types";

describe("Schema Platforms MySQLSchemaTest parity scaffold", () => {
  it("generates MySQL foreign-key SQL", () => {
    const platform = new MySQLPlatform();
    const table = new Table("test");
    table.addColumn("foo_id", Types.INTEGER, { columnDefinition: "INT" });
    table.addForeignKeyConstraint("test_foreign", ["foo_id"], ["foo_id"]);

    const sqls = table
      .getForeignKeys()
      .map((fk) => platform.getCreateForeignKeySQL(fk, table.getQuotedName(platform)));

    expect(sqls).toHaveLength(1);
    expect(sqls[0]).toContain("ALTER TABLE test ADD");
    expect(sqls[0]).toContain("FOREIGN KEY (foo_id) REFERENCES test_foreign (foo_id)");
  });

  it("does not report a diff when tables are unchanged under the generic comparator", () => {
    const platform = new MySQLPlatform();
    const oldTable = new Table("test");
    oldTable.addColumn("id", Types.INTEGER, { columnDefinition: "INT" });
    oldTable.addColumn("description", Types.STRING, { length: 65536 });

    const newTable = new Table("test");
    newTable.addColumn("id", Types.INTEGER, { columnDefinition: "INT" });
    newTable.addColumn("description", Types.STRING, { length: 65536 });

    const diff = new Comparator().compareTables(oldTable, newTable);

    expect(diff === null || diff.hasChanges() === false).toBe(true);
    expect(platform).toBeInstanceOf(MySQLPlatform);
  });

  it.skip(
    "ports Doctrine's MySQL-specific schema comparator/collation metadata assertions (MySQL comparator layer is not implemented in this Node port)",
  );
});
