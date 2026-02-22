export enum MatchType {
  FULL = "FULL",
  PARTIAL = "PARTIAL",
  SIMPLE = "SIMPLE",
}

export function matchTypeToSQL(matchType: MatchType): string {
  return matchType;
}
