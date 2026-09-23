import { figue } from 'figue';

export const config = figue({
  app: {
    version: {
      doc: 'Application current version',
      format: 'string',
      default: '0.0.0',
      env: 'APP_VERSION',
    },
    lastCommitSha: {
      doc: 'Application last commit SHA version',
      format: 'string',
      default: '',
      env: 'APP_COMMIT_SHA',
    },
    siteUrl: {
      doc: 'Public URL of the deployed site (analytics and ads are only loaded on this host)',
      format: 'string',
      default: '',
      env: 'APP_SITE_URL',
    },
    baseUrl: {
      doc: 'Application base url',
      format: 'string',
      default: '/',
      env: 'BASE_URL',
    },
    env: {
      doc: 'Application current env',
      format: 'enum',
      values: ['production', 'development', 'preview', 'test'],
      default: 'development',
      env: 'VITE_VERCEL_ENV',
    },
  },
  plausible: {
    isTrackerEnabled: {
      doc: 'Is the tracker enabled',
      format: 'boolean',
      default: false,
      env: 'VITE_TRACKER_ENABLED',
    },
    domain: {
      doc: 'Plausible current domain',
      format: 'string',
      default: '',
      env: 'VITE_PLAUSIBLE_DOMAIN',
    },
    apiHost: {
      doc: 'Plausible remote api host',
      format: 'string',
      default: '',
      env: 'VITE_PLAUSIBLE_API_HOST',
    },
    trackLocalhost: {
      doc: 'Enable or disable localhost tracking by plausible',
      format: 'boolean',
      default: false,
    },
  },
  analytics: {
    gaMeasurementId: {
      doc: 'Google Analytics 4 measurement ID (G-XXXXXXXXXX), empty to disable',
      format: 'string',
      default: 'G-G6QY47LXN8',
      env: 'VITE_GA_MEASUREMENT_ID',
    },
  },
  adsense: {
    clientId: {
      doc: 'Google AdSense publisher ID (ca-pub-XXXXXXXXXXXXXXXX), empty to disable',
      format: 'string',
      default: 'ca-pub-6608473900936395',
      env: 'VITE_ADSENSE_CLIENT_ID',
    },
  },
  showBanner: {
    doc: 'Show the banner',
    format: 'boolean',
    default: false,
    env: 'VITE_SHOW_BANNER',
  },
  showSponsorBanner: {
    doc: 'Show the sponsor banner',
    format: 'boolean',
    default: false,
    env: 'VITE_SHOW_SPONSOR_BANNER',
  },
})
  .loadEnv({
    ...import.meta.env,
    // These strings are statically replaced at build time (see 'define' in vite.config.ts)
    APP_VERSION: import.meta.env.APP_VERSION,
    APP_COMMIT_SHA: import.meta.env.APP_COMMIT_SHA,
    APP_SITE_URL: import.meta.env.APP_SITE_URL,
  })
  .validate()
  .getConfig();
