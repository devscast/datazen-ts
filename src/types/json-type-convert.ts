import { SerializationFailed, ValueNotConvertible } from "./exception/index";

export function convertJsonToDatabaseValue(value: unknown): string | null {
  if (value === null) {
    return null;
  }

  try {
    return JSON.stringify(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown serialization error";
    throw SerializationFailed.new(value, "json", message, error);
  }
}

export function convertJsonToNodeValue(value: unknown): unknown {
  if (value === null || value === "") {
    return null;
  }

  try {
    return JSON.parse(String(value));
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown parsing error";
    throw ValueNotConvertible.new(value, "json", message, error);
  }
}
