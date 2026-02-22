import { Index } from "../../index";
import { IndexedColumn } from "../../index/indexed-column";
import { IndexEditor } from "../../index-editor";
import { IndexColumnMetadataRow } from "../../metadata/index-column-metadata-row";
import { UnqualifiedName } from "../../name/unqualified-name";

export class IndexColumnMetadataProcessor {
  public initializeEditor(row: IndexColumnMetadataRow): IndexEditor {
    return Index.editor()
      .setName(UnqualifiedName.quoted(row.getIndexName()).toString())
      .setType(row.getType())
      .setIsClustered(row.isClustered())
      .setPredicate(row.getPredicate());
  }

  public applyRow(editor: IndexEditor, row: IndexColumnMetadataRow): void {
    editor.addColumn(
      new IndexedColumn(UnqualifiedName.quoted(row.getColumnName()), row.getColumnLength()),
    );
  }
}
