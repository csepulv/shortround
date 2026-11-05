// Structured search lines with tolerance: the slot grammar stays, the words vary. Typos, aliases, a missing verb, and
// modifiers like "starred".
//
// A freeform term runs until a reserved word, so a param after the term needs a hint (`with`, `sort by`, `sorted by`,
// `of`, ...). Each rewritten line names its earlier form.
//
// `accept` lists every call that counts as right. Slots left out must be empty.

const STARRED = ['favorites-relevance', 'favorites-bookmarked'];
const withFavorites = (call) => STARRED.map((sort) => ({ ...call, sort }));

export const CORPUS = [
  // Strict lines: the engine alone should read these.
  {
    // was: search grid sort favorites-bookmarked tags react format web
    text: 'search grid with sort favorites-bookmarked tags react format web',
    accept: [{ term: 'grid', tags: ['react'], format: ['web'], sort: 'favorites-bookmarked' }]
  },
  { text: 'search owl with tags react', accept: [{ term: 'owl', tags: ['react'] }] },
  {
    text: 'search state management sorted by relevance',
    accept: [{ term: 'state management', sort: 'relevance' }]
  },
  {
    text: 'search owl with tag react and tag design',
    accept: [{ term: 'owl', tags: ['react', 'design'] }]
  },

  // Rewrites: modifiers, connector aliases, no verb.
  { text: 'starred with tags react', accept: withFavorites({ tags: ['react'] }) },
  {
    text: 'favorites about ai with type chat',
    accept: withFavorites({ term: 'ai', format: ['chat'] })
  },
  {
    text: 'favorites for ai of type chat',
    accept: withFavorites({ term: 'ai', format: ['chat'] })
  },
  { text: 'starred', accept: withFavorites({}) },

  // No verb: Search is implied.
  {
    text: 'with tags ai and design sort newest',
    accept: [{ tags: ['ai', 'design'], sort: 'bookmarked-newest' }]
  },
  {
    text: 'type chat about vector databases',
    accept: [{ format: ['chat'], term: 'vector databases' }]
  },
  { text: 'kind tool with tags design', accept: [{ kind: ['tool'], tags: ['design'] }] },
  {
    text: 'tagged react-native kind library',
    accept: [{ tags: ['react-native'], kind: ['library'] }]
  },

  // Connector and marker aliases.
  {
    text: 'search react grid of kind library sort newest',
    accept: [{ term: 'react grid', kind: ['library'], sort: 'bookmarked-newest' }]
  },
  {
    text: 'search llm prompt engineering of type chat',
    accept: [{ term: 'llm prompt engineering', format: ['chat'] }]
  },
  {
    text: 'search the css grid guide',
    accept: [{ term: 'the css grid guide' }, { term: 'css grid guide' }]
  },

  // Sort values said another way. (was: search owl sort latest, ... oldest, ... best match, ... recently created)
  { text: 'search owl sort by latest', accept: [{ term: 'owl', sort: 'bookmarked-newest' }] },
  { text: 'search owl sort by oldest', accept: [{ term: 'owl', sort: 'bookmarked-oldest' }] },
  { text: 'search owl sort by best match', accept: [{ term: 'owl', sort: 'relevance' }] },
  {
    text: 'search owl sort by recently created',
    accept: [{ term: 'owl', sort: 'created-newest' }]
  },

  // Typos in verbs, markers, connectors and values.
  // was: serach owl tags react
  { text: 'serach owl with tags react', accept: [{ term: 'owl', tags: ['react'] }] },
  { text: 'search owl with tgas react', accept: [{ term: 'owl', tags: ['react'] }] },
  { text: 'search owl wiht tags react', accept: [{ term: 'owl', tags: ['react'] }] },
  { text: 'search owl with tags raect', accept: [{ term: 'owl', tags: ['react'] }] },
  {
    text: 'search owl with tags react, desgin',
    accept: [{ term: 'owl', tags: ['react', 'design'] }]
  },
  // was: search grid sotr newest
  {
    text: 'search grid with sotr newest',
    accept: [{ term: 'grid', sort: 'bookmarked-newest' }]
  },
  {
    text: 'search css grid guide of type wbe',
    accept: [{ term: 'css grid guide', format: ['web'] }]
  },
  // was: find react grid kind libary
  {
    text: 'find react grid with kind libary',
    accept: [{ term: 'react grid', kind: ['library'] }]
  }
];
