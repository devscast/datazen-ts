import { PostgreSQLPlatform } from "../../../../platforms/postgre-sql-platform";
import { registerAbstractColumnTestCase } from "./abstract-column-test-case";

registerAbstractColumnTestCase({
  doctrineClassName: "PostgreSQL",
  platformClass: PostgreSQLPlatform,
});
