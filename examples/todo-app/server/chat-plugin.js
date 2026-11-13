import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { createAnthropic } from '@ai-sdk/anthropic';

import { respondToChat } from './chat-route.js';

const CHAT_MODEL = 'claude-opus-5-5';

/** Serves POST /api/chat from the Vite dev server, so the key stays in Node (ANTHROPIC_API_KEY, from `.env.local`). */
export function chatPlugin({ apiKey }) {
  const model = apiKey ? createAnthropic({ apiKey })(CHAT_MODEL) : null;
  return {
    name: 'todo-chat-route',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (request, response, next) => {
        if (request.method !== 'POST') {
          return next();
        }
        const abandoned = abortWhenClosedEarly(response);
        try {
          const body = JSON.parse(await readBody(request));
          const answer = await respondToChat(body, { model, abortSignal: abandoned.signal });
          await sendWebResponse(response, answer);
        } catch (error) {
          if (abandoned.signal.aborted) {
            return;
          }
          server.config.logger.error(`[api/chat] ${error.stack ?? error}`);
          endWithError(response, error);
        }
      });
    }
  };
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function sendWebResponse(response, webResponse) {
  response.statusCode = webResponse.status;
  webResponse.headers.forEach((value, name) => response.setHeader(name, value));
  if (!webResponse.body) {
    response.end();
    return;
  }
  await pipeline(Readable.fromWeb(webResponse.body), response);
}

function abortWhenClosedEarly(response) {
  const controller = new AbortController();
  response.on('close', () => {
    if (!response.writableFinished) {
      controller.abort();
    }
  });
  return controller;
}

function endWithError(response, error) {
  if (response.headersSent) {
    response.destroy();
    return;
  }
  response.statusCode = 500;
  response.end(String(error.message ?? error));
}
