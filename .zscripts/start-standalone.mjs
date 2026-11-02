// Cross-platform production start (replaces `NODE_ENV=production bun ... | tee`,
// neither of which works on Windows). Run with: bun .zscripts/start-standalone.mjs
process.env.NODE_ENV ||= 'production';
await import(new URL('../.next/standalone/server.js', import.meta.url));
