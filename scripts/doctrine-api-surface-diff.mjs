#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const doctrineSrcRoot = path.join(repoRoot, "references", "dbal-full", "src");
const portSrcRoot = path.join(repoRoot, "src");

const SCOPE_CONFIG = {
  core: {
    doctrineIncludes: [
      "ArrayParameters.php",
      "ColumnCase.php",
      "Configuration.php",
      "Connection.php",
      "ConnectionException.php",
      "Driver.php",
      "DriverManager.php",
      "Exception.php",
      "ExpandArrayParameters.php",
      "LockMode.php",
      "ParameterType.php",
      "Query.php",
      "Result.php",
      "ServerVersionProvider.php",
      "Statement.php",
      "TransactionIsolationLevel.php",
    ],
    portIncludes: [
      "array-parameters.ts",
      "column-case.ts",
      "configuration.ts",
      "connection.ts",
      "connection-exception.ts",
      "driver.ts",
      "driver-manager.ts",
      "exception.ts",
      "expand-array-parameters.ts",
      "lock-mode.ts",
      "parameter-type.ts",
      "query.ts",
      "result.ts",
      "server-version-provider.ts",
      "statement.ts",
      "transaction-isolation-level.ts",
    ]
  },
  arrayParameters: {
    doctrineIncludes: ["ArrayParameters"],
    portIncludes: ["array-parameters"],
  },
  connection: {
    doctrineIncludes: ["Connection"],
    portIncludes: ["connection"],
  },
  connections: {
    doctrineIncludes: ["Connections"],
    portIncludes: ["connections"],
  },
   driver: {
    doctrineIncludes: ["Driver"],
    portIncludes: ["driver"],
  },
  exception: {
    doctrineIncludes: ["Exception"],
    portIncludes: ["exception"],
  },
  logging: {
    doctrineIncludes: ["Logging"],
    portIncludes: ["logging"],
  },
  platforms: {
    doctrineIncludes: ["Platforms"],
    portIncludes: ["platforms"],
  },
  portability: {
    doctrineIncludes: ["Portability"],
    portIncludes: ["portability"],
  },
  query: {
    doctrineIncludes: ["Query"],
    portIncludes: ["query"],
  },
  schema: {
    doctrineIncludes: ["Schema"],
    portIncludes: ["schema"],
  },
  sql: {
    doctrineIncludes: ["SQL"],
    portIncludes: ["sql"],
  },
  tools: {
    doctrineIncludes: ["Tools"],
    portIncludes: ["tools"],
  },
  types: {
    doctrineIncludes: ["Types"],
    portIncludes: ["types"],
  }
};

const EXCLUDED_METHODS_EXACT = new Set([
  "__construct",
  "__clone",
  "__destruct",
  "__toString",
  "__serialize",
  "__unserialize",
  "__debugInfo",
  "__invoke",
  "__set",
  "__get",
  "__isset",
  "__unset",
]);

const EXCLUDED_METHOD_PATTERNS = [
  /cache/i,
];

const DOCTRINE_TO_PORT_METHOD_ALIASES = new Map([
  ["initializeDoctrineTypeMappings", ["initializeDatazenTypeMappings"]],
  ["initializeAllDoctrineTypeMappings", ["ensureDatazenTypeMappingsInitialized"]],
  ["columnToArray", ["columnToCreateTableArray"]],
  ["convertToPHPValue", ["convertToNodeValue"]],
  ["convertToPHPValueSQL", ["convertToNodeValueSQL"]],
]);

const PORT_TO_DOCTRINE_METHOD_ALIASES = new Map(
  [...DOCTRINE_TO_PORT_METHOD_ALIASES.entries()].flatMap(([doctrineName, portNames]) =>
    portNames.map((portName) => [portName, doctrineName]),
  ),
);

const PHP_METHOD_REGEX =
  /(?:^|\n)\s*(?:final\s+|abstract\s+)*(public|protected|private)\s+(?:static\s+)?function\s+([A-Za-z_]\w*)\s*\(/g;

const TS_CLASS_METHOD_REGEX =
  /^\s*(public|protected|private)\s+(?:static\s+)?(?:override\s+)?(?:readonly\s+)?(?:abstract\s+)?(?:async\s+)?(?:\*\s*)?([A-Za-z_$][\w$]*)\s*(?:<[\s\S]*?>)?\s*\(/gm;

const TS_INTERFACE_METHOD_REGEX =
  /^\s*([A-Za-z_$][\w$]*)\s*(?:<[\s\S]*?>)?\s*\([\s\S]*?\)\s*:\s*[\s\S]*?;$/gm;
const TS_CLASS_DECLARATION_REGEX =
  /\bexport\s+(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)(?:\s+extends\s+([A-Za-z_$][\w$]*))?/u;

function usage() {
  console.log(
    [
      "Usage: node scripts/doctrine-api-surface-diff.mjs [--scope core|schema|all] [--json]",
      "",
      "Scopes:",
      "  core   Connection / Driver / Query / Statement / Result areas",
      "  schema Schema module",
      "  all    Both (default)",
    ].join("\n"),
  );
}

function parseArgs(argv) {
  let scope = "all";
  let asJson = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }

    if (arg === "--json") {
      asJson = true;
      continue;
    }

    if (arg === "--scope") {
      scope = argv[index + 1] ?? scope;
      index += 1;
      continue;
    }
  }

  if (scope !== "all" && !Object.hasOwn(SCOPE_CONFIG, scope)) {
    throw new Error(`Unknown scope "${scope}". Expected core, schema, or all.`);
  }

  return { asJson, scope };
}

function isExcludedMethodName(name) {
  if (EXCLUDED_METHODS_EXACT.has(name)) {
    return true;
  }

  return EXCLUDED_METHOD_PATTERNS.some((pattern) => pattern.test(name));
}

function walkFilesRecursively(root) {
  if (!fs.existsSync(root)) {
    return [];
  }

  const entries = fs.readdirSync(root, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkFilesRecursively(fullPath));
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

function listIncludedFiles(baseRoot, includes, extension) {
  const files = [];

  for (const include of includes) {
    const target = path.join(baseRoot, include);
    if (!fs.existsSync(target)) {
      continue;
    }

    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      files.push(
        ...walkFilesRecursively(target).filter(
          (filePath) =>
            filePath.endsWith(extension) &&
            !filePath.endsWith(".test.ts") &&
            !filePath.endsWith(".spec.ts"),
        ),
      );
      continue;
    }

    if (target.endsWith(extension)) {
      files.push(target);
    }
  }

  return files;
}

function toKebabCase(segment) {
  return segment
    .replace(/\.php$/i, "")
    .replace(/\.ts$/i, "")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
}

function normalizeDoctrineKey(absoluteFilePath) {
  const relativePath = path.relative(doctrineSrcRoot, absoluteFilePath);
  const segments = relativePath.split(path.sep).map(toKebabCase);
  return segments.join("/");
}

function normalizePortKey(absoluteFilePath) {
  const relativePath = path.relative(portSrcRoot, absoluteFilePath);
  const segments = relativePath.split(path.sep).map(toKebabCase);
  return segments.join("/");
}

function createMethodBuckets() {
  return {
    public: new Set(),
    protected: new Set(),
    private: new Set(),
  };
}

function parsePhpMethods(source) {
  const methods = createMethodBuckets();

  for (const match of source.matchAll(PHP_METHOD_REGEX)) {
    const visibility = match[1];
    const methodName = match[2];

    if (!visibility || !methodName) {
      continue;
    }

    methods[visibility].add(methodName);
  }

  return methods;
}

function parseTsMethods(source) {
  const methods = createMethodBuckets();

  for (const match of source.matchAll(TS_CLASS_METHOD_REGEX)) {
    const visibility = match[1];
    const methodName = match[2];

    if (!visibility || !methodName) {
      continue;
    }

    methods[visibility].add(methodName);
  }

  for (const match of source.matchAll(TS_INTERFACE_METHOD_REGEX)) {
    const methodName = match[1];
    if (!methodName || methodName === "constructor") {
      continue;
    }

    methods.public.add(methodName);
  }

  for (const methodName of parseTsNamespaceExportedFunctions(source)) {
    methods.public.add(methodName);
  }

  return methods;
}

function parseTsClassInfo(source) {
  const match = source.match(TS_CLASS_DECLARATION_REGEX);
  if (!match) {
    return null;
  }

  return {
    className: match[1] ?? null,
    extendsClassName: match[2] ?? null,
  };
}

function parseTsNamespaceExportedFunctions(source) {
  const methods = new Set();
  const lines = source.split(/\r?\n/u);
  let namespaceDepth = 0;
  let pendingNamespace = false;

  for (const line of lines) {
    if (/^\s*export\s+namespace\s+[A-Za-z_$][\w$]*\b/u.test(line)) {
      pendingNamespace = true;
    }

    if (namespaceDepth > 0) {
      const namespaceFunctionMatch = line.match(/^\s*export\s+function\s+([A-Za-z_$][\w$]*)\s*\(/u);
      const methodName = namespaceFunctionMatch?.[1];
      if (methodName) {
        methods.add(methodName);
      }
    }

    const opens = (line.match(/{/g) ?? []).length;
    const closes = (line.match(/}/g) ?? []).length;

    if (pendingNamespace && opens > 0) {
      namespaceDepth += opens;
      pendingNamespace = false;
    } else if (pendingNamespace && opens === 0) {
      continue;
    } else if (namespaceDepth > 0) {
      namespaceDepth += opens;
    }

    if (namespaceDepth > 0 && closes > 0) {
      namespaceDepth = Math.max(0, namespaceDepth - closes);
    }
  }

  return methods;
}

function loadMethodMap(kind, files) {
  const map = new Map();

  for (const filePath of files) {
    const source = fs.readFileSync(filePath, "utf8");
    const key = kind === "doctrine" ? normalizeDoctrineKey(filePath) : normalizePortKey(filePath);
    const methods = kind === "doctrine" ? parsePhpMethods(source) : parseTsMethods(source);
    const classInfo = kind === "port" ? parseTsClassInfo(source) : null;
    map.set(key, { classInfo, filePath, methods });
  }

  return map;
}

function cloneMethodBuckets(methods) {
  return {
    public: new Set(methods.public),
    protected: new Set(methods.protected),
    private: new Set(methods.private),
  };
}

function mergeMethodBuckets(target, source) {
  for (const visibility of ["public", "protected", "private"]) {
    for (const method of source[visibility]) {
      target[visibility].add(method);
    }
  }
}

function buildEffectivePortMethodMap(portMap) {
  const methodsByKey = new Map();
  const keyByClassName = new Map();

  for (const [key, entry] of portMap.entries()) {
    const className = entry.classInfo?.className;
    if (!className || keyByClassName.has(className)) {
      continue;
    }

    keyByClassName.set(className, key);
  }

  const visiting = new Set();

  function resolve(key) {
    if (methodsByKey.has(key)) {
      return methodsByKey.get(key);
    }

    const entry = portMap.get(key);
    if (!entry) {
      const empty = createMethodBuckets();
      methodsByKey.set(key, empty);
      return empty;
    }

    if (visiting.has(key)) {
      return cloneMethodBuckets(entry.methods);
    }

    visiting.add(key);
    const effective = cloneMethodBuckets(entry.methods);
    const parentClassName = entry.classInfo?.extendsClassName;

    if (parentClassName) {
      const parentKey = keyByClassName.get(parentClassName);
      if (parentKey && parentKey !== key) {
        mergeMethodBuckets(effective, resolve(parentKey));
      }
    }

    visiting.delete(key);
    methodsByKey.set(key, effective);
    return effective;
  }

  for (const key of portMap.keys()) {
    resolve(key);
  }

  return methodsByKey;
}

function diffMethodSets(doctrineMethods, portMethods) {
  const result = {
    missing: [],
    missingExcluded: [],
    extra: [],
    extraExcluded: [],
  };

  for (const visibility of ["public", "protected", "private"]) {
    const doctrineSet = doctrineMethods[visibility];
    const portSet = portMethods[visibility];

    for (const methodName of doctrineSet) {
      if (hasCompatiblePortVisibility(portMethods, visibility, methodName)) {
        continue;
      }

      const entry = { method: methodName, visibility };
      if (isExcludedMethodName(methodName)) {
        result.missingExcluded.push(entry);
      } else {
        result.missing.push(entry);
      }
    }

    for (const methodName of portSet) {
      if (hasCompatibleDoctrineVisibility(doctrineMethods, visibility, methodName)) {
        continue;
      }

      const entry = { method: methodName, visibility };
      if (isExcludedMethodName(methodName)) {
        result.extraExcluded.push(entry);
      } else {
        result.extra.push(entry);
      }
    }
  }

  result.missing.sort(compareMethodEntries);
  result.missingExcluded.sort(compareMethodEntries);
  result.extra.sort(compareMethodEntries);
  result.extraExcluded.sort(compareMethodEntries);

  return result;
}

function hasCompatiblePortVisibility(portMethods, doctrineVisibility, methodName) {
  const methodNames = [methodName, ...(DOCTRINE_TO_PORT_METHOD_ALIASES.get(methodName) ?? [])];

  if (doctrineVisibility === "protected") {
    return methodNames.some(
      (name) => portMethods.protected.has(name) || portMethods.public.has(name),
    );
  }

  return methodNames.some((name) => portMethods[doctrineVisibility].has(name));
}

function hasCompatibleDoctrineVisibility(doctrineMethods, portVisibility, methodName) {
  const methodNames = [methodName, PORT_TO_DOCTRINE_METHOD_ALIASES.get(methodName)].filter(Boolean);

  if (portVisibility === "public") {
    return methodNames.some(
      (name) => doctrineMethods.public.has(name) || doctrineMethods.protected.has(name),
    );
  }

  return methodNames.some((name) => doctrineMethods[portVisibility].has(name));
}

function compareMethodEntries(a, b) {
  if (a.visibility !== b.visibility) {
    return a.visibility.localeCompare(b.visibility);
  }

  return a.method.localeCompare(b.method);
}

function runScope(scopeName) {
  const config = SCOPE_CONFIG[scopeName];
  const doctrineFiles = listIncludedFiles(doctrineSrcRoot, config.doctrineIncludes, ".php");
  const portFiles = listIncludedFiles(portSrcRoot, config.portIncludes, ".ts");

  const doctrineMap = loadMethodMap("doctrine", doctrineFiles);
  const portMap = loadMethodMap("port", portFiles);
  const effectivePortMethodsByKey = buildEffectivePortMethodMap(portMap);

  const allKeys = new Set([...doctrineMap.keys(), ...portMap.keys()]);
  const missingFiles = [];
  const extraFiles = [];
  const diffs = [];

  for (const key of [...allKeys].sort()) {
    const doctrineEntry = doctrineMap.get(key);
    const portEntry = portMap.get(key);

    if (!doctrineEntry) {
      extraFiles.push({
        key,
        portFile: path.relative(repoRoot, portEntry.filePath),
      });
      continue;
    }

    if (!portEntry) {
      missingFiles.push({
        doctrineFile: path.relative(repoRoot, doctrineEntry.filePath),
        key,
      });
      continue;
    }

    const methodDiff = diffMethodSets(
      doctrineEntry.methods,
      effectivePortMethodsByKey.get(key) ?? portEntry.methods,
    );
    if (
      methodDiff.missing.length === 0 &&
      methodDiff.extra.length === 0 &&
      methodDiff.missingExcluded.length === 0 &&
      methodDiff.extraExcluded.length === 0
    ) {
      continue;
    }

    diffs.push({
      doctrineFile: path.relative(repoRoot, doctrineEntry.filePath),
      key,
      portFile: path.relative(repoRoot, portEntry.filePath),
      ...methodDiff,
    });
  }

  const summary = {
    comparedFiles: diffs.filter((d) => true).length,
    doctrineFiles: doctrineFiles.length,
    matchedFiles: [...allKeys].filter((key) => doctrineMap.has(key) && portMap.has(key)).length,
    missingFiles: missingFiles.length,
    portFiles: portFiles.length,
    extraFiles: extraFiles.length,
    missingMethods: diffs.reduce((sum, d) => sum + d.missing.length, 0),
    missingMethodsExcluded: diffs.reduce((sum, d) => sum + d.missingExcluded.length, 0),
    extraMethods: diffs.reduce((sum, d) => sum + d.extra.length, 0),
    extraMethodsExcluded: diffs.reduce((sum, d) => sum + d.extraExcluded.length, 0),
  };

  return {
    exclusions: {
      exact: [...EXCLUDED_METHODS_EXACT].sort(),
      patterns: EXCLUDED_METHOD_PATTERNS.map((pattern) => String(pattern)),
    },
    scope: scopeName,
    summary,
    missingFiles,
    extraFiles,
    diffs,
  };
}

function printHumanReport(report) {
  console.log(`\n[${report.scope}]`);
  console.log(
    `files: doctrine=${report.summary.doctrineFiles}, port=${report.summary.portFiles}, matched=${report.summary.matchedFiles}`,
  );
  console.log(
    `missing files=${report.summary.missingFiles}, extra files=${report.summary.extraFiles}`,
  );
  console.log(
    `method diffs: missing=${report.summary.missingMethods} (excluded=${report.summary.missingMethodsExcluded}), extra=${report.summary.extraMethods} (excluded=${report.summary.extraMethodsExcluded})`,
  );
  console.log(
    `excluded methods: ${report.exclusions.exact.join(", ")} + patterns ${report.exclusions.patterns.join(", ")}`,
  );

  const topMissing = report.diffs
    .filter((entry) => entry.missing.length > 0)
    .sort((a, b) => b.missing.length - a.missing.length)
    .slice(0, 10);

  if (topMissing.length > 0) {
    console.log("top files with non-excluded missing methods:");
    for (const entry of topMissing) {
      const methods = entry.missing.map((m) => `${m.visibility}:${m.method}`).join(", ");
      console.log(`- ${entry.key} (${entry.portFile}) -> ${methods}`);
    }
  }

  const topExcludedMissing = report.diffs
    .filter((entry) => entry.missingExcluded.length > 0)
    .sort((a, b) => b.missingExcluded.length - a.missingExcluded.length)
    .slice(0, 5);

  if (topExcludedMissing.length > 0) {
    console.log("excluded missing methods (not reported as parity gaps):");
    for (const entry of topExcludedMissing) {
      const methods = entry.missingExcluded.map((m) => `${m.visibility}:${m.method}`).join(", ");
      console.log(`- ${entry.key} -> ${methods}`);
    }
  }
}

function main() {
  const { asJson, scope } = parseArgs(process.argv.slice(2));
  const scopes = scope === "all" ? Object.keys(SCOPE_CONFIG) : [scope];
  const reports = scopes.map(runScope);

  if (asJson) {
    console.log(JSON.stringify({ reports }, null, 2));
    return;
  }

  console.log("Datazen Doctrine API Surface Diff (best effort)");
  for (const report of reports) {
    printHumanReport(report);
  }
}

main();
