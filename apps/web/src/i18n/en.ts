/**
 * Source of truth for the UI copy. Every other locale is typed against this
 * object, so adding a string here makes the compiler demand a translation.
 */
export const en = {
  /** Passed to toLocaleString for numbers and dates. */
  formatLocale: 'en-US',
  htmlLang: 'en',
  label: 'English',

  app: {
    name: 'Bid Portal',
    tagline: 'Antique auction lots from several houses, in one place.',
  },

  nav: {
    search: 'Search',
    watchlist: 'Watchlist',
    sources: 'Sources',
    settings: 'Settings',
    signOut: 'Sign out',
    currencyLabel: 'Display currency',
    keepOriginal: 'Original currency',
    languageLabel: 'Language',
  },

  login: {
    email: 'Email',
    password: 'Password',
    submit: 'Sign in',
    failed: 'Wrong email or password.',
  },

  search: {
    title: 'Find lots',
    placeholder: 'e.g. tiffany lamp, rococo table, bronze statue…',
    inputLabel: 'Search keyword',
    submit: 'Search',
    searching: 'Searching…',
    forbidden: 'You do not have access to the admin pages.',
    noResults: 'Nothing matched that keyword.',
    lastChecked: (when: string) => `Last checked: ${when}`,
    truncatedCached: 'The last crawl did not finish — more lots are still out there.',
    allSourcesFailed: 'Every source failed — details below.',
    someSourcesFailed: 'Some sources failed, so this list is incomplete.',
    pollTimeout: 'The search is not responding. Try again, or check that the worker is running.',
    progressFailed: 'Could not read search progress.',
    requestFailed: 'Search failed.',
    itemCount: (n: number) => `${n} ${n === 1 ? 'lot' : 'lots'}`,
    stillMore: 'more available, not fetched',
  },

  sourceStatus: {
    pending: 'queued',
    running: 'fetching',
    ok: 'done',
    zero_results: 'no results (adapter may be broken)',
    error: 'error',
    blocked: 'blocked',
    disabled: 'turned off',
  },

  card: {
    lot: (n: string) => `Lot ${n}`,
    viewOn: (source: string) => `View on ${source}`,
    estimate: (value: string) => `Estimate: ${value}`,
    unknownCurrency: '(currency unknown)',
    unknownCurrencyHint: 'The source did not say which currency this lot is in',
    convertedHint: 'Reference conversion at rates refreshed daily',
    liveApproximate: '(live sale, closing time is an estimate)',
    noPrice: '—',
    watchAdd: 'Save to watchlist',
    watchRemove: 'Remove from watchlist',
    closed: 'closed',
    daysLeft: (n: number) => `${n} ${n === 1 ? 'day' : 'days'} left`,
    hoursLeft: (n: number) => `${n} ${n === 1 ? 'hour' : 'hours'} left`,
    minutesLeft: (n: number) => `${n} ${n === 1 ? 'minute' : 'minutes'} left`,
    endsAtHint: (when: string, tz: string) => `${when} (${tz})`,
  },

  priceKind: {
    current_bid: 'Current bid',
    starting_bid: 'Starting bid',
    buy_now: 'Buy now',
    sold: 'Sold',
    estimate: 'Estimate',
    unknown: 'No price yet',
  },

  listingStatus: {
    ended: 'Ended',
    sold: 'Sold',
    withdrawn: 'Withdrawn',
    stale: 'May have been pulled',
  },

  watchlist: {
    title: 'Saved lots',
    empty: 'Nothing saved yet. Go to',
    emptyLinkText: 'Search',
    emptyAfter: 'and press ☆ on a lot you want to follow.',
    endedOn: (date: string) => `Ended ${date}`,
  },

  admin: {
    sourcesTitle: 'Sources',
    workerStale: (hours: number) =>
      `No crawl in the last ${hours} ${hours === 1 ? 'hour' : 'hours'} — the worker may have stopped.`,
    colSource: 'Source',
    colStatus: 'Status',
    colInterval: 'Min interval',
    enabled: 'on',
    disabled: 'off',
    turnOff: 'Turn off',
    turnOn: 'Turn on',
    recentRuns: 'Recent runs',
    noRuns: 'No runs yet.',
    colStarted: 'Started',
    colKeyword: 'Keyword',
    colResult: 'Result',
    colItems: 'Lots',
    colPages: 'Pages',
    colError: 'Error',

    settingsTitle: 'Settings',
    saved: 'Saved.',
    rejected: (keys: string) => `Invalid values ignored: ${keys}`,
    save: 'Save',
    timezoneLabel: 'Display timezone',
    timezoneHint: 'Used for countdowns and digests. Example: Asia/Ho_Chi_Minh',
    pagesLabel: 'Pages fetched per source, per keyword',
    pagesHint: 'HiBid returns 100 lots per page, Invaluable 40, LiveAuctioneers 24.',
    cacheLabel: 'Result cache lifetime (hours)',
    cacheHint: 'Within this window the same keyword is served from storage instead of crawling.',
  },

  runStatus: {
    ok: 'ok',
    error: 'error',
    blocked: 'blocked (historical)',
    zero_results: '0 results (suspect breakage)',
  },

  errors: {
    adminOnly: '403 — admin access only',
  },
}

export type Dictionary = typeof en
