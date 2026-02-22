import { DefaultExpression } from "../default-expression";

export class CurrentTimestamp implements DefaultExpression {
  public toSQL(): string {
    return "CURRENT_TIMESTAMP";
  }
}
