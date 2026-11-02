// Cross-platform replacement for:
//   cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/
// (cp/tee don't exist on Windows.) Run with: bun .zscripts/copy-standalone.mjs
import { cpSync, existsSync } from 'node:fs';

const pairs = [
  ['.next/static', '.next/standalone/.next/static'],
  ['public', '.next/standalone/public'],
];

for (const [from, to] of pairs) {
  if (existsSync(from)) {
    cpSync(from, to, { recursive: true });
    console.log(`copied ${from} -> ${to}`);
  } else {
    console.log(`skip (missing): ${from}`);
  }
}
