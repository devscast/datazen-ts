import { AbstractAsset } from "./abstract-asset";
import { ViewEditor } from "./view-editor";

export class View extends AbstractAsset {
  constructor(
    name: string,
    private sql: string,
  ) {
    super(name);
  }

  public getSql(): string {
    return this.sql;
  }

  public static editor(): ViewEditor {
    return new ViewEditor();
  }

  public edit(): ViewEditor {
    return View.editor().setName(this.getName()).setSQL(this.sql);
  }
}
