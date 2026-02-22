export enum Deferrability {
  NOT_DEFERRABLE = "NOT DEFERRABLE",
  DEFERRABLE = "DEFERRABLE",
  DEFERRED = "INITIALLY DEFERRED",
}

export function deferrabilityToSQL(deferrability: Deferrability): string {
  return deferrability;
}
