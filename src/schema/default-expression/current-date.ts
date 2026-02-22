import { DefaultExpression } from "../default-expression";

export class CurrentDate implements DefaultExpression {
  public toSQL(): string {
    return "CURRENT_DATE";
  }
}
