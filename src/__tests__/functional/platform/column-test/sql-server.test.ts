import { SQLServerPlatform } from "../../../../platforms/sql-server-platform";
import { registerAbstractColumnTestCase } from "./abstract-column-test-case";

registerAbstractColumnTestCase({
  doctrineClassName: "SQLServer",
  platformClass: SQLServerPlatform,
  skippedDoctrineTests: new Set([
    "testVariableLengthStringNoLength",
    "testVariableLengthBinaryNoLength",
  ]),
});
