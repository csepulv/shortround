/**
 * The host's chat transport, with a body worked out when each request is made. The AI SDK repeats the previous
 * request's body when it continues after a tool runs, so a body that must follow the app's state (the tools available
 * now) is added here rather than passed to `sendMessage`.
 */
export function withRequestBody(transport, makeBody) {
  return {
    sendMessages: async (options) =>
      transport.sendMessages({ ...options, body: { ...options.body, ...(await makeBody()) } }),
    reconnectToStream: (options) => transport.reconnectToStream(options)
  };
}
