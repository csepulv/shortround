// Shared test inputs: the commands and lookups (./commands.js), the structured corpus (./corpus.js), and
// `OPERATOR_LINES` with their expected calls, as data (each names its earlier form).

import { makeCommandBuilder } from '../../engine.js';
import { ADD, makeLookups, SEARCH } from './commands.js';
import { CORPUS } from './corpus.js';

export { CORPUS };

export const now = () => new Date('2026-11-01T12:00:00');

export const makeEngine = (options = {}) =>
  makeCommandBuilder({
    commands: [SEARCH, ADD],
    lookups: makeLookups(options),
    now,
    ...options.engine
  });

const SERVICES = ['claude', 'chatgpt', 'claude-code'];
// was: search fire alarm type chat service claude, chatgpt, claude-code
const FIRE_ALARM = 'search fire alarm with type chat service claude, chatgpt, claude-code';

export const OPERATOR_LINES = [
  [
    // was: find in chats about fine tuning models kind article, library service claude newer than a year
    'find in chats about fine tuning models with kind article, library service claude newer than a year',
    {
      term: 'fine tuning models',
      format: ['chat'],
      kind: ['article', 'library'],
      service: ['claude'],
      bookmarked: { start: '2025-11-01' }
    }
  ],
  [
    'recent in chats about photo printers',
    { sort: 'bookmarked-newest', format: ['chat'], term: 'photo printers' }
  ],
  [
    `${FIRE_ALARM} from last week`,
    {
      term: 'fire alarm',
      format: ['chat'],
      service: SERVICES,
      bookmarked: { start: '2026-10-25', end: '2026-11-01' }
    }
  ],
  [
    `${FIRE_ALARM} from July`,
    {
      term: 'fire alarm',
      format: ['chat'],
      service: SERVICES,
      bookmarked: { start: '2026-07-01', end: '2026-07-31' }
    }
  ],
  [
    `${FIRE_ALARM} from Jun-Sep 2025`,
    {
      term: 'fire alarm',
      format: ['chat'],
      service: SERVICES,
      bookmarked: { start: '2025-06-01', end: '2025-09-30' }
    }
  ]
];

// Everything a UI would use, without the work counters.
export const visible = ({
  readings,
  nextSteps,
  annotations,
  problem,
  incomplete,
  pending,
  failed
}) => ({ readings, nextSteps, annotations, problem, incomplete, pending, failed });
