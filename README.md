# DataZen : TypeScript Database Abstraction Layer

![npm](https://img.shields.io/npm/v/@devscast/datazen?style=flat-square)
![npm](https://img.shields.io/npm/dt/@devscast/datazen?style=flat-square)
[![Lint](https://github.com/devscast/datazen-ts/actions/workflows/lint.yml/badge.svg?branch=main)](https://github.com/devscast/datazen-ts/actions/workflows/lint.yml)
[![Tests](https://github.com/devscast/datazen-ts/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/devscast/datazen-ts/actions/workflows/test.yml)
![GitHub](https://img.shields.io/github/license/devscast/datazen-ts?style=flat-square)

---

## Overview

DataZen is a TypeScript database abstraction layer for teams that want SQL-first development without committing to a full ORM. It provides a portable query builder API and a lightweight runtime layer for executing queries consistently across drivers.

The project focuses on DBAL concerns: SQL generation, parameter binding (including typed and array parameters), statement/result abstractions, transaction handling, and platform-specific behavior. It is designed to be predictable, testable, and practical for both greenfield projects and incremental migrations.

## Attribution
This project is fully inspired by the architecture and design of `doctrine/dbal`.
Datazen is a TypeScript/Node implementation and is not affiliated with Doctrine.

## Contributors

<a href="https://github.com/devscast/datazen-ts/graphs/contributors" title="show all contributors">
  <img src="https://contrib.rocks/image?repo=devscast/datazen-ts" alt="contributors"/>
</a>

