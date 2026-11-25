// Options, their validation and the plugin order check. Kept out of
// src/index.js because Docusaurus treats a `validateOptions` export on the
// plugin module as its own options hook.
const { DEFAULT_RESOURCE_ROUTE } = require('./template');

const PLUGIN_NAME = '@stackql/docusaurus-plugin-stackql-deploy-template';
const AEO_PLUGIN_NAME = '@stackql/docusaurus-plugin-aeo';
const PLACEMENTS = ['breadcrumb-row', 'none'];

function normalizeOptions(raw) {
  const opts = raw || {};
  return {
    placement: opts.placement === undefined ? 'breadcrumb-row' : opts.placement,
    askAi: opts.askAi === undefined ? 'auto' : opts.askAi,
    showOnMobile: opts.showOnMobile === undefined ? false : opts.showOnMobile,
    resourceRoute: opts.resourceRoute === undefined ? DEFAULT_RESOURCE_ROUTE : opts.resourceRoute,
  };
}

/** Throws one error listing every invalid option. */
function validateOptions(opts) {
  const errs = [];
  if (!PLACEMENTS.includes(opts.placement)) {
    errs.push(`placement must be one of ${PLACEMENTS.map((p) => `"${p}"`).join(', ')}, got ${JSON.stringify(opts.placement)}`);
  }
  if (!['auto', true, false].includes(opts.askAi)) {
    errs.push(`askAi must be "auto", true or false, got ${JSON.stringify(opts.askAi)}`);
  }
  if (typeof opts.showOnMobile !== 'boolean') {
    errs.push('showOnMobile must be a boolean');
  }
  if (typeof opts.resourceRoute !== 'string' || opts.resourceRoute.length === 0) {
    errs.push('resourceRoute must be a regular expression source string');
  } else {
    let valid = true;
    try {
      new RegExp(opts.resourceRoute); // eslint-disable-line no-new
    } catch (e) {
      valid = false;
      errs.push(`resourceRoute is not a valid regular expression: ${e.message}`);
    }
    // `<source>|` matches the empty string, and the match has one entry per
    // capture group after the whole match: the resource name needs one.
    if (valid && new RegExp(`${opts.resourceRoute}|`).exec('').length < 2) {
      errs.push('resourceRoute must have a capture group for the resource name');
    }
  }
  if (errs.length) {
    throw new Error(`[${PLUGIN_NAME}] invalid options:\n  - ${errs.join('\n  - ')}`);
  }
}

// The name of a plugins / themes entry: 'name', ['name', options] or a
// resolved path; null for a function or an inline plugin object.
function entryName(entry) {
  const target = Array.isArray(entry) ? entry[0] : entry;
  return typeof target === 'string' ? target.replace(/\\/g, '/') : null;
}

function entryOptions(entry) {
  return Array.isArray(entry) && entry[1] && typeof entry[1] === 'object' ? entry[1] : {};
}

function findEntry(entries, packageName) {
  const index = entries.findIndex((e) => {
    const name = entryName(e);
    return name !== null && name.includes(packageName);
  });
  return index === -1 ? null : { index, options: entryOptions(entries[index]) };
}

/**
 * Both this plugin and @stackql/docusaurus-plugin-aeo (with Ask AI on its
 * default placement) provide the DocBreadcrumbs theme component, and the one
 * Docusaurus loads last is used: theme components of two plugins do not
 * chain. This plugin renders the Ask AI button in its own row, so it must
 * load after the AEO plugin; listed before it, its row would be replaced by
 * the AEO row and the template menu would be missing without an error.
 * Returns the error message, or null when the order is right.
 */
function pluginOrderError(siteConfig) {
  if (!siteConfig) return null;
  // Docusaurus loads preset plugins and themes, then siteConfig.plugins,
  // then siteConfig.themes.
  const entries = [...(siteConfig.plugins || []), ...(siteConfig.themes || [])].filter(Boolean);
  const self = findEntry(entries, 'docusaurus-plugin-stackql-deploy-template');
  const aeo = findEntry(entries, 'docusaurus-plugin-aeo');
  if (!self || !aeo || aeo.index < self.index) return null;
  const aeoAskAi = aeo.options.askAi || {};
  if (aeoAskAi.enabled === false || aeoAskAi.placement === 'none') return null;
  return (
    `[${PLUGIN_NAME}] list this plugin after ${AEO_PLUGIN_NAME} in docusaurus.config.js ` +
    '(or under `themes`, which load after `plugins`). Both provide the DocBreadcrumbs theme ' +
    'component and the one loaded last is used; this plugin renders the Ask AI button in its own row.'
  );
}

module.exports = {
  PLUGIN_NAME,
  AEO_PLUGIN_NAME,
  PLACEMENTS,
  normalizeOptions,
  validateOptions,
  pluginOrderError,
};
