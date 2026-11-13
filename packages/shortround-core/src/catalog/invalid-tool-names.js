const TOOL_NAME_CHARACTERS = /^[a-zA-Z0-9_-]+$/;
const LONGEST_TOOL_NAME = 64;

const reasonsAgainst = (name) => [
  ...(TOOL_NAME_CHARACTERS.test(name) ? [] : ['a tool name has only letters, digits, _ and -']),
  ...(name.length > LONGEST_TOOL_NAME
    ? [`a tool name has at most ${LONGEST_TOOL_NAME} characters`]
    : [])
];

/**
 * The commands whose names a model provider won't take as tool names (letters, digits, `_` and `-`, up to 64
 * characters), with why. Planned commands are left out. Takes a checked or a loaded catalog.
 */
export const findInvalidToolNames = (catalog) =>
  Object.entries(catalog.commands)
    .filter(([, command]) => !command.planned)
    .map(([name]) => ({ command: name, reasons: reasonsAgainst(name) }))
    .filter(({ reasons }) => reasons.length)
    .map(({ command, reasons }) => ({ command, reason: reasons.join('; ') }));
