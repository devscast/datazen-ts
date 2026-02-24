export enum MatchType {
  FULL = "FULL",
  PARTIAL = "PARTIAL",
  SIMPLE = "SIMPLE",
}

export function matchTypeToSQL(matchType: MatchType): string {
  return matchType;
}

export namespace MatchType {
  export function toSQL(matchType: MatchType): string {
    return matchType;
  }
}
