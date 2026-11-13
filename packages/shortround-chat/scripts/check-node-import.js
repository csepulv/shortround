// An app's server code imports @shortround/chat/server's built entry, as published; it must load in plain Node with no
// browser and no React. The browser entry must load in Node too (server rendering, Node tests). Run it after
// `pnpm build`.
import { readFileSync } from 'node:fs';

if (typeof window !== 'undefined') {
  throw new Error('check-node-import must run in plain Node, with no window');
}

// By the package's own name, so Node resolves it through `exports`, as an app would.
const server = await import('@shortround/chat/server');

for (const name of [
  'parseIntentionChatRequest',
  'intentionModelMessages',
  'intentionToolSet',
  'intentionErrorText'
]) {
  if (typeof server[name] !== 'function') {
    throw new Error(`@shortround/chat/server's built entry loaded without ${name}`);
  }
}
if (typeof server.intentionToolsSchema?.safeParse !== 'function') {
  throw new Error("@shortround/chat/server's built entry loaded without intentionToolsSchema");
}
if (typeof server.INTENTION_CHAT_SYSTEM_PROMPT !== 'string') {
  throw new Error(
    "@shortround/chat/server's built entry loaded without INTENTION_CHAT_SYSTEM_PROMPT"
  );
}

// The server entry's own imports, read from the build: only the AI SDK and zod, never React or the browser packages.
const serverBuild = readFileSync(new URL('../dist/server.js', import.meta.url), 'utf8');
const imported = [...serverBuild.matchAll(/from\s*["']([^"']+)["']/g)].map((match) => match[1]);
const unexpected = imported.filter((name) => !['ai', 'zod'].includes(name));
if (unexpected.length) {
  throw new Error(
    `@shortround/chat/server's built entry imports ${unexpected.join(', ')}; it may import only ai and zod`
  );
}

const chat = await import('@shortround/chat');
for (const name of ['IntentionChat', 'useIntentionChat', 'makeIntentionChat']) {
  if (typeof chat[name] !== 'function') {
    throw new Error(`@shortround/chat's built entry loaded without ${name}`);
  }
}

console.log(
  '@shortround/chat: both built entries import in plain Node; the server entry without React'
);
