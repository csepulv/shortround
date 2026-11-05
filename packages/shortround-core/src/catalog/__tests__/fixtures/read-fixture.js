import { readFileSync } from 'node:fs';

// Test catalogs and example files live next to this module, as YAML.
export const readFixture = (name) => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');
