import { DefaultExpression } from "../default-expression";

export class CurrentTime implements DefaultExpression {
  public toSQL(): string {
    return "CURRENT_TIME";
  }
}
