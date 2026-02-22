import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    driver: "src/driver/index.ts",
    exception: "src/exception/index.ts",
    logging: "src/logging/index.ts",
    platforms: "src/platforms/index.ts",
    portability: "src/portability/index.ts",
    query: "src/query/index.ts",
    schema: "src/schema/module.ts",
    sql: "src/sql/index.ts",
    tools: "src/tools/index.ts",
    types: "src/types/index.ts",
  },
  clean: true,
  format: ["cjs", "esm"],
  dts: true,
});
