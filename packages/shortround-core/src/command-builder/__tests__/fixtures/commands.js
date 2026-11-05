// A search app's Search and Add bookmark in the command shape: params, labels, argSource. Lookups are stubs shaped
// like the app's rows; each receives context (the command, the args
// filled so far).

const SORTS = [
  { value: 'relevance', title: 'Relevance', aliases: ['best match'] },
  {
    value: 'bookmarked-newest',
    title: 'Bookmarked (newest)',
    aliases: ['latest', 'newest', 'recent']
  },
  { value: 'favorites-relevance', title: 'Favorites + Relevance' },
  {
    value: 'favorites-bookmarked',
    title: 'Favorites + Bookmarked',
    aliases: ['starred', 'favorites']
  },
  { value: 'created-newest', title: 'Created (newest)', aliases: ['recently created'] },
  { value: 'bookmarked-oldest', title: 'Bookmarked (oldest)', aliases: ['oldest'] },
  { value: 'created-oldest', title: 'Created (oldest)' }
];

const AGE_HINTS = ['from', 'since', 'newer than', 'older than'];

// `recent` as a time range: the last 30 days.
const RECENT = { value: 'last 30 days', title: 'Recent', aliases: ['recent'] };

// Phrases to suggest while a date is typed. Each parses with ranges.js; "this week" is left out because
// the wrapper reads it as the whole year.
const asPhrases = (phrases) => phrases.map((phrase) => ({ value: phrase, title: phrase }));
const DATE_PHRASES = [
  'today',
  'yesterday',
  'last 7 days',
  'last week',
  'last 30 days',
  'this month',
  'last month',
  'last 90 days',
  'this year',
  'last year'
];

export const SEARCH = {
  name: 'search',
  label: 'Search',
  aliases: ['find', 'look for'],
  run: 'links.search.apply',
  params: {
    term: {
      label: 'Search',
      default: true,
      hints: ['for', 'about'],
      argSource: { freeform: true, type: 'text' }
    },
    tags: {
      label: 'Tags',
      list: true,
      hints: ['with'],
      aliases: ['tags', 'tag', 'tagged'],
      argSource: { lookup: 'facetValues.tags' }
    },
    format: {
      label: 'Format',
      list: true,
      hints: ['with', 'of', 'in'],
      aliases: ['format', 'type'],
      argSource: { lookup: 'facetValues.content_format' }
    },
    kind: {
      label: 'Kind',
      list: true,
      hints: ['with', 'of'],
      aliases: ['kind', 'kinds', 'type'],
      argSource: { lookup: 'facetValues.kinds' }
    },
    service: {
      label: 'Service',
      list: true,
      hints: ['from'],
      aliases: ['service', 'services'],
      argSource: { lookup: 'facetValues.service' }
    },
    // Priorities: `recent` as a sort beats `recent` as a range, and the bookmark age beats the created age.
    // Hints let a sort follow a term: "search owl sort by latest", "... with sort latest".
    sort: {
      label: 'Sort',
      priority: 3,
      hints: ['with', 'sort by', 'sorted by'],
      aliases: ['sort', 'sort by', 'sorted by'],
      argSource: { list: SORTS }
    },
    bookmarked: {
      label: 'Bookmarked',
      priority: 2,
      hints: AGE_HINTS,
      aliases: ['bookmarked'],
      // "Recent" already stands for the last 30 days here, so that phrase isn't listed twice.
      argSource: {
        freeform: true,
        type: 'range',
        list: [RECENT, ...asPhrases(DATE_PHRASES.filter((phrase) => phrase !== RECENT.value))]
      }
    },
    created: {
      label: 'Created',
      priority: 1,
      hints: AGE_HINTS,
      aliases: ['created'],
      argSource: { freeform: true, type: 'range', list: asPhrases(DATE_PHRASES) }
    }
  }
};

export const ADD = {
  name: 'add',
  label: 'Add bookmark',
  aliases: ['bookmark', 'save'],
  run: 'links.bookmarks.add',
  params: {
    url: {
      label: 'URL',
      required: true,
      default: true,
      argSource: { freeform: true, type: 'url' }
    },
    tags: {
      label: 'Tags',
      list: true,
      hints: ['with'],
      aliases: ['tags', 'tag', 'tagged'],
      argSource: { freeform: true, type: 'text', lookup: 'allTags' }
    },
    kind: {
      label: 'Kind',
      list: true,
      hints: ['as', 'with'],
      aliases: ['kind', 'kinds'],
      argSource: { freeform: true, type: 'text', lookup: 'allKinds' }
    }
  }
};

const asRows = (values) => values.map((value) => ({ value, title: value }));

export function makeLookups({
  tags = ['react', 'react-native', 'grid', 'ai', 'design'],
  onLookup = () => {}
} = {}) {
  const facets = {
    tags,
    content_format: ['web', 'chat', 'note'],
    kinds: ['library', 'tool', 'article'],
    service: ['claude', 'chatgpt', 'claude-code', 'gemini']
  };
  const withContext = (name, rows) => (context) => {
    onLookup(name, context);
    return asRows(rows);
  };
  return {
    'facetValues.tags': withContext('facetValues.tags', facets.tags),
    'facetValues.content_format': withContext('facetValues.content_format', facets.content_format),
    'facetValues.kinds': withContext('facetValues.kinds', facets.kinds),
    'facetValues.service': withContext('facetValues.service', facets.service),
    allTags: withContext('allTags', facets.tags),
    allKinds: withContext('allKinds', facets.kinds)
  };
}
