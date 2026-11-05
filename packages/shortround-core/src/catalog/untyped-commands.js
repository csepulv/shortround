import { isTypedName } from '../command-builder/readings.js';

// The commands a typed line can't reach: a name that isn't a plain lowercase word and no aliases. They are still rows.
// Planned commands are left out, as loadCatalog leaves them out. Takes a checked or a loaded catalog.
export const findUntypedCommands = (catalog) =>
  Object.entries(catalog.commands)
    .filter(([name, command]) => !command.planned && !isTypedName(name) && !command.aliases?.length)
    .map(([name, command]) => ({ command: name, label: command.label }));
