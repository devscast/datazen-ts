import { Column } from "../../schema/column";
import { MatchType } from "../../schema/foreign-key-constraint/match-type";
import { ReferentialAction } from "../../schema/foreign-key-constraint/referential-action";
import { IndexType } from "../../schema/index/index-type";
import { Types } from "../../types/types";
import type { AbstractPlatform } from "../abstract-platform";

export function pickString(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "number" || typeof value === "bigint") {
      return String(value);
    }
  }

  return null;
}

export function pickNumber(row: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

export function pickBoolean(row: Record<string, unknown>, ...keys: string[]): boolean | null {
  for (const key of keys) {
    const value = row[key];
    const normalized = asBoolean(value);
    if (normalized !== null) {
      return normalized;
    }
  }

  return null;
}

export function mapIndexType(row: Record<string, unknown>): IndexType {
  const explicitType = pickString(row, "index_type", "INDEX_TYPE", "type", "TYPE")?.toUpperCase();
  if (explicitType === "FULLTEXT") {
    return IndexType.FULLTEXT;
  }

  if (explicitType === "SPATIAL") {
    return IndexType.SPATIAL;
  }

  const unique = pickBoolean(row, "is_unique", "IS_UNIQUE");
  if (unique === true) {
    return IndexType.UNIQUE;
  }

  const nonUnique = pickBoolean(row, "non_unique", "NON_UNIQUE");
  if (nonUnique === false) {
    return IndexType.UNIQUE;
  }

  return IndexType.REGULAR;
}

export function mapReferentialAction(action: string | null): ReferentialAction {
  if (action === null) {
    return ReferentialAction.NO_ACTION;
  }

  const normalized = action.toUpperCase().replaceAll("_", " ");
  switch (normalized) {
    case ReferentialAction.CASCADE:
      return ReferentialAction.CASCADE;
    case ReferentialAction.SET_NULL:
      return ReferentialAction.SET_NULL;
    case ReferentialAction.SET_DEFAULT:
      return ReferentialAction.SET_DEFAULT;
    case ReferentialAction.RESTRICT:
      return ReferentialAction.RESTRICT;
    default:
      return ReferentialAction.NO_ACTION;
  }
}

export function mapMatchType(matchType: string | null): MatchType {
  if (matchType === null) {
    return MatchType.SIMPLE;
  }

  const normalized = matchType.toUpperCase();
  if (normalized === MatchType.FULL) {
    return MatchType.FULL;
  }

  if (normalized === MatchType.PARTIAL) {
    return MatchType.PARTIAL;
  }

  return MatchType.SIMPLE;
}

export function createColumnFromMetadataRow(
  platform: AbstractPlatform,
  row: Record<string, unknown>,
): Column {
  const columnName = pickString(row, "column_name", "COLUMN_NAME", "name", "NAME");
  if (columnName === null) {
    throw new Error("Missing column_name in metadata row.");
  }

  const rawDbType = pickString(
    row,
    "data_type",
    "DATA_TYPE",
    "type",
    "TYPE_NAME",
    "coltype",
    "COLTYPE",
  );
  const dbType = normalizeDbType(rawDbType);
  const typeName = resolveTypeName(platform, dbType);

  const nullable = readNullable(row);
  const length = pickNumber(
    row,
    "character_maximum_length",
    "CHARACTER_MAXIMUM_LENGTH",
    "max_length",
    "MAX_LENGTH",
    "length",
    "LENGTH",
  );
  const precision = pickNumber(row, "numeric_precision", "NUMERIC_PRECISION", "precision");
  const scale = pickNumber(row, "numeric_scale", "NUMERIC_SCALE", "scale");
  const comment = pickString(
    row,
    "column_comment",
    "COLUMN_COMMENT",
    "comment",
    "REMARKS",
    "remarks",
  );
  const charset = pickString(row, "character_set_name", "CHARACTER_SET_NAME", "charset");
  const collation = pickString(row, "collation_name", "COLLATION_NAME", "collation");
  const defaultValue = pickDefaultValue(row);

  const options: Record<string, unknown> = {
    notnull: nullable === null ? true : !nullable,
  };

  if (defaultValue !== undefined) {
    options.default = defaultValue;
  }

  if (length !== null) {
    options.length = length;
  }

  if (precision !== null) {
    options.precision = precision;
  }

  if (scale !== null) {
    options.scale = scale;
  }

  if (comment !== null) {
    options.comment = comment;
  }

  if (isUnsignedDbType(rawDbType)) {
    options.unsigned = true;
  }

  if (isFixedLengthType(dbType)) {
    options.fixed = true;
  }

  if (isAutoincrementRow(row)) {
    options.autoincrement = true;
  }

  const column = new Column(columnName, typeName, options);

  if (charset !== null) {
    column.setPlatformOption("charset", charset);
  }

  if (collation !== null) {
    column.setPlatformOption("collation", collation);
  }

  return column;
}

export function buildTableOptions(row: Record<string, unknown>): Record<string, unknown> {
  const options: Record<string, unknown> = {};

  const engine = pickString(row, "engine", "ENGINE");
  const charset = pickString(
    row,
    "table_charset",
    "TABLE_CHARSET",
    "character_set_name",
    "CHARACTER_SET_NAME",
  );
  const collation = pickString(row, "table_collation", "TABLE_COLLATION", "collation_name");
  const comment = pickString(row, "table_comment", "TABLE_COMMENT", "comment");
  const autoincrement = pickNumber(row, "auto_increment", "AUTO_INCREMENT");

  if (engine !== null) {
    options.engine = engine;
  }
  if (charset !== null) {
    options.charset = charset;
  }
  if (collation !== null) {
    options.collation = collation;
  }
  if (comment !== null) {
    options.comment = comment;
  }
  if (autoincrement !== null) {
    options.autoincrement = autoincrement;
  }

  return options;
}

function readNullable(row: Record<string, unknown>): boolean | null {
  const isNullable = pickString(row, "is_nullable", "IS_NULLABLE");
  if (isNullable !== null) {
    return isNullable.toUpperCase() === "YES";
  }

  const notNull = pickBoolean(row, "notnull", "NOTNULL", "is_not_null", "IS_NOT_NULL");
  if (notNull !== null) {
    return !notNull;
  }

  const nullable = pickBoolean(row, "nullable", "NULLABLE");
  if (nullable !== null) {
    return nullable;
  }

  return null;
}

function pickDefaultValue(row: Record<string, unknown>): unknown {
  for (const key of [
    "column_default",
    "COLUMN_DEFAULT",
    "default_value",
    "DEFAULT_VALUE",
    "dflt_value",
    "DFLT_VALUE",
  ]) {
    if (Object.hasOwn(row, key)) {
      return row[key];
    }
  }

  return undefined;
}

function normalizeDbType(dbType: string | null): string {
  if (dbType === null) {
    return "varchar";
  }

  return dbType
    .toLowerCase()
    .replace(/\(.*/, "")
    .replace(/\s+unsigned$/, "")
    .trim();
}

function resolveTypeName(platform: AbstractPlatform, dbType: string): string {
  try {
    if (platform.hasDatazenTypeMappingFor(dbType)) {
      return platform.getDatazenTypeMapping(dbType);
    }
  } catch {
    // fall through to heuristics below
  }

  if (dbType.includes("char")) {
    return Types.STRING;
  }
  if (dbType.includes("text") || dbType.includes("clob")) {
    return Types.TEXT;
  }
  if (dbType.includes("blob") || dbType.includes("binary")) {
    return Types.BLOB;
  }
  if (dbType.includes("int")) {
    return Types.INTEGER;
  }
  if (dbType.includes("bool")) {
    return Types.BOOLEAN;
  }
  if (dbType.includes("json")) {
    return Types.JSON;
  }
  if (dbType.includes("date") && dbType.includes("time")) {
    return Types.DATETIME_MUTABLE;
  }
  if (dbType === "date") {
    return Types.DATE_MUTABLE;
  }
  if (dbType === "time") {
    return Types.TIME_MUTABLE;
  }
  if (dbType.includes("real") || dbType.includes("float") || dbType.includes("double")) {
    return Types.FLOAT;
  }
  if (dbType.includes("dec") || dbType.includes("num")) {
    return Types.DECIMAL;
  }

  return Types.STRING;
}

function isUnsignedDbType(rawDbType: string | null): boolean {
  return typeof rawDbType === "string" && /\bunsigned\b/i.test(rawDbType);
}

function isFixedLengthType(dbType: string): boolean {
  return dbType === "char" || dbType === "nchar" || dbType === "character";
}

function isAutoincrementRow(row: Record<string, unknown>): boolean {
  const extra = pickString(row, "extra", "EXTRA");
  if (extra !== null && /auto_increment/i.test(extra)) {
    return true;
  }

  const isIdentity = pickBoolean(row, "is_identity", "IS_IDENTITY", "identity", "IDENTITY");
  if (isIdentity === true) {
    return true;
  }

  return false;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "y"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "n"].includes(normalized)) {
      return false;
    }
  }

  return null;
}
