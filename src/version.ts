/**
 * Package version, read from package.json at runtime so it never drifts.
 * Resolves relative to this file: src/ (tests) and dist/ (published) both sit one level below the package root.
 */

import { readFileSync } from 'fs';

const pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf-8')
) as { version: string };

export const VERSION: string = pkg.version;
