import { isTypedName, typedLabelOf } from '../command-builder/readings.js';

// The commands a typed line can't reach: a name that isn't a plain lowercase word, a label that isn't plain words, and
// no aliases. They are still rows. Planned commands are left out, as loadCatalog leaves them out. Takes a checked or a
// loaded catalog.
export const findUntypedCommands = (catalog) =>
  Object.entries(catalog.commands)
    .filter(
      ([name, command]) =>
        !command.planned &&
        !isTypedName(name) &&
        !typedLabelOf(command.label) &&
        !command.aliases?.length
    )
    .map(([name, command]) => ({ command: name, label: command.label }));
