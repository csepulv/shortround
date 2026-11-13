// A mock model whose answers are scripted turn by turn: each turn is text, or tool calls.
import { convertArrayToReadableStream, MockLanguageModelV4 } from 'ai/test';

const USAGE = {
  inputTokens: { total: 3, noCache: 3, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 2, text: 2, reasoning: undefined }
};

const textParts = (text) => [
  { type: 'text-start', id: 't1' },
  { type: 'text-delta', id: 't1', delta: text },
  { type: 'text-end', id: 't1' },
  { type: 'finish', finishReason: { unified: 'stop', raw: 'end_turn' }, usage: USAGE }
];

const toolCallParts = (calls) => [
  ...calls.map(({ toolName, input }, index) => ({
    type: 'tool-call',
    toolCallId: `call-${toolName}-${index}`,
    toolName,
    input: JSON.stringify(input)
  })),
  { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_use' }, usage: USAGE }
];

/** turns: `'some text'` or `{ toolCalls: [{ toolName, input }] }`, in order; the last repeats. */
export function makeScriptedModel(turns) {
  let turn = 0;
  return new MockLanguageModelV4({
    doStream: async () => {
      const answer = turns[Math.min(turn, turns.length - 1)];
      turn += 1;
      const parts =
        typeof answer === 'string' ? textParts(answer) : toolCallParts(answer.toolCalls);
      return { stream: convertArrayToReadableStream(parts) };
    }
  });
}

export const userSays = (text, id = 'u1') => ({
  id,
  role: 'user',
  parts: [{ type: 'text', text }]
});
