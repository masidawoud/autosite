#!/usr/bin/env node
// CJS wrapper for @tinacms/cli — needed because @tinacms/cli has "type":"module"
// in its package.json but its bin file is extensionless (Node 20 rejects it).
// Dynamic import works fine from a .cjs file.
const [, , ...args] = process.argv;
import("../node_modules/@tinacms/cli/dist/index.js")
  .then((cli) => cli.default.runExit(args))
  .catch((err) => {
    console.error("Failed to load tinacms CLI:", err);
    process.exit(1);
  });
