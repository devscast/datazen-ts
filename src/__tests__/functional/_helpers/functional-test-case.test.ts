import { describe, expect, it } from "vitest";

import { NotSupported } from "../../../platforms/exception/not-supported";
import { ForeignKeyConstraint } from "../../../schema/foreign-key-constraint";
import { Index } from "../../../schema/index";
import { Identifier } from "../../../schema/name/identifier";
import { OptionallyQualifiedName } from "../../../schema/name/optionally-qualified-name";
import { UnqualifiedName } from "../../../schema/name/unqualified-name";
import { PrimaryKeyConstraint } from "../../../schema/primary-key-constraint";
import { useFunctionalTestCase } from "./functional-test-case";

describe("FunctionalTestCase helpers", () => {
  const ft = useFunctionalTestCase();

  it("normalizes name helpers to quoted equivalents and supports list assertions", () => {
    const quotedIdentifier = ft.toQuotedIdentifier(Identifier.unquoted("users"));
    expect(quotedIdentifier.isQuoted()).toBe(true);
    expect(quotedIdentifier.toString()).toBe('"users"');

    ft.assertUnqualifiedNameEquals(
      UnqualifiedName.unquoted("users"),
      UnqualifiedName.quoted("users"),
    );
    ft.assertOptionallyQualifiedNameEquals(
      OptionallyQualifiedName.unquoted("users", "public"),
      OptionallyQualifiedName.quoted("users", "public"),
    );

    const unqualifiedList = [UnqualifiedName.quoted("users"), UnqualifiedName.unquoted("posts")];

    ft.assertUnqualifiedNameListEquals(
      [UnqualifiedName.unquoted("users"), UnqualifiedName.quoted("posts")],
      unqualifiedList,
    );
    ft.assertUnqualifiedNameListContainsUnquotedName("users", unqualifiedList);
    ft.assertUnqualifiedNameListContainsQuotedName("users", unqualifiedList);
    ft.assertUnqualifiedNameListNotContainsUnquotedName("comments", unqualifiedList);
    expect(ft.unqualifiedNameListContains(UnqualifiedName.quoted("posts"), unqualifiedList)).toBe(
      true,
    );

    const optionallyQualifiedList = [
      OptionallyQualifiedName.quoted("users", "public"),
      OptionallyQualifiedName.unquoted("posts"),
    ];
    ft.assertOptionallyQualifiedNameListContainsUnquotedName(
      "users",
      "public",
      optionallyQualifiedList,
    );
    expect(
      ft.optionallyQualifiedNameListContains(
        OptionallyQualifiedName.quoted("posts"),
        optionallyQualifiedList,
      ),
    ).toBe(true);
    expect(
      ft.optionallyQualifiedNameListContains(
        OptionallyQualifiedName.unquoted("users", null),
        optionallyQualifiedList,
      ),
    ).toBe(false);

    expect(
      ft
        .toQuotedUnqualifiedNameList([UnqualifiedName.unquoted("a"), UnqualifiedName.quoted("b")])
        .map((name) => name.toString()),
    ).toEqual(['"a"', '"b"']);
    expect(
      ft.toQuotedOptionallyQualifiedName(OptionallyQualifiedName.unquoted("x", "y")).toString(),
    ).toBe('"y"."x"');
  });

  it("normalizes indexed columns and indexes for comparison helpers", () => {
    const expectedIndex = IndexLikeBuilders.index("idx_users_name", ["name"], { lengths: [8] });
    const actualIndex = IndexLikeBuilders.index('"idx_users_name"', ['"name"'], { lengths: [8] });

    expect(
      ft.toQuotedIndexedColumn(expectedIndex.getIndexedColumns()[0]!).getColumnName().toString(),
    ).toBe('"name"');
    ft.assertIndexedColumnListEquals(
      expectedIndex.getIndexedColumns(),
      actualIndex.getIndexedColumns(),
    );

    ft.assertIndexEquals(expectedIndex, actualIndex);
    ft.assertIndexListEquals(
      [IndexLikeBuilders.index("idx_z", ["z"]), expectedIndex],
      [actualIndex, IndexLikeBuilders.index('"idx_z"', ['"z"'])],
    );

    expect(ft.toQuotedIndex(expectedIndex).getObjectName().toString()).toBe('"idx_users_name"');
    expect(
      ft.toQuotedIndexList([expectedIndex]).map((index) => index.getObjectName().toString()),
    ).toEqual(['"idx_users_name"']);
  });

  it("normalizes primary and foreign key constraints for comparison helpers", () => {
    const expectedPrimaryKey = PrimaryKeyConstraint.editor()
      .setName("primary")
      .setColumnNames("id")
      .create();
    const actualPrimaryKey = PrimaryKeyConstraint.editor()
      .setName('"primary"')
      .setColumnNames('"id"')
      .create();

    ft.assertPrimaryKeyConstraintEquals(expectedPrimaryKey, actualPrimaryKey);
    expect(ft.toQuotedPrimaryKeyConstraint(expectedPrimaryKey).getColumnNames()).toEqual(['"id"']);

    const expectedForeignKey = ForeignKeyConstraint.editor()
      .setName("fk_posts_user")
      .setReferencingColumnNames("user_id")
      .setReferencedTableName("public.users")
      .setReferencedColumnNames("id")
      .create();
    const actualForeignKey = ForeignKeyConstraint.editor()
      .setName('"fk_posts_user"')
      .setReferencingColumnNames('"user_id"')
      .setReferencedTableName('"public"."users"')
      .setReferencedColumnNames('"id"')
      .create();

    ft.assertForeignKeyConstraintEquals(expectedForeignKey, actualForeignKey);
    ft.assertForeignKeyConstraintListEquals([expectedForeignKey], [actualForeignKey]);
    expect(
      ft.toQuotedForeignKeyConstraintList([expectedForeignKey])[0]?.getForeignTableName(),
    ).toBe('"public"."users"');
  });

  it("throws NotSupported for dropSchemaIfExists on sqlite", async () => {
    await expect(ft.dropSchemaIfExists(UnqualifiedName.unquoted("app"))).rejects.toThrow(
      NotSupported,
    );
  });
});

const IndexLikeBuilders = {
  index: (name: string, columns: string[], options: Record<string, unknown> = {}) =>
    Index.editor()
      .setName(name)
      .setColumns(...columns)
      .setOptions(options)
      .create(),
};
