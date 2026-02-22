export enum ReferentialAction {
  CASCADE = "CASCADE",
  NO_ACTION = "NO ACTION",
  SET_DEFAULT = "SET DEFAULT",
  SET_NULL = "SET NULL",
  RESTRICT = "RESTRICT",
}

export function referentialActionToSQL(referentialAction: ReferentialAction): string {
  return referentialAction;
}
