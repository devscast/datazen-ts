import { ForeignKeyConstraint } from "../../foreign-key-constraint";
import { Deferrability } from "../../foreign-key-constraint/deferrability";
import { ForeignKeyConstraintEditor } from "../../foreign-key-constraint-editor";
import { ForeignKeyConstraintColumnMetadataRow } from "../../metadata/foreign-key-constraint-column-metadata-row";
import { OptionallyQualifiedName } from "../../name/optionally-qualified-name";
import { UnqualifiedName } from "../../name/unqualified-name";

export class ForeignKeyConstraintColumnMetadataProcessor {
  constructor(private readonly currentSchemaName: string | null = null) {}

  public initializeEditor(row: ForeignKeyConstraintColumnMetadataRow): ForeignKeyConstraintEditor {
    const editor = ForeignKeyConstraint.editor();

    const constraintName = row.getName();
    if (constraintName !== null) {
      editor.setName(UnqualifiedName.quoted(constraintName).toString());
    }

    let referencedSchemaName = row.getReferencedSchemaName();
    if (referencedSchemaName === this.currentSchemaName) {
      referencedSchemaName = null;
    }

    editor
      .setReferencedTableName(
        OptionallyQualifiedName.quoted(row.getReferencedTableName(), referencedSchemaName),
      )
      .setMatchType(row.getMatchType())
      .setOnUpdateAction(row.getOnUpdateAction())
      .setOnDeleteAction(row.getOnDeleteAction());

    if (row.isDeferred()) {
      editor.setDeferrability(Deferrability.DEFERRED);
    } else if (row.isDeferrable()) {
      editor.setDeferrability(Deferrability.DEFERRABLE);
    }

    return editor;
  }

  public applyRow(
    editor: ForeignKeyConstraintEditor,
    row: ForeignKeyConstraintColumnMetadataRow,
  ): void {
    editor
      .addReferencingColumnName(UnqualifiedName.quoted(row.getReferencingColumnName()))
      .addReferencedColumnName(UnqualifiedName.quoted(row.getReferencedColumnName()));
  }
}
