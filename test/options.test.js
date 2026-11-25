const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const plugin = require('../src/index');
const { normalizeOptions, validateOptions, pluginOrderError } = require('../src/options');
const { DEFAULT_RESOURCE_ROUTE } = require('../src/template');

const SELF = '@stackql/docusaurus-plugin-stackql-deploy-template';
const AEO = '@stackql/docusaurus-plugin-aeo';
const context = (plugins = [SELF], themes = []) => ({ siteConfig: { plugins, themes } });

test('defaults', () => {
  assert.deepEqual(normalizeOptions(undefined), {
    placement: 'breadcrumb-row',
    askAi: 'auto',
    showOnMobile: false,
    resourceRoute: DEFAULT_RESOURCE_ROUTE,
  });
});

test('invalid options are reported together', () => {
  const opts = normalizeOptions({ placement: 'navbar', askAi: 'yes', showOnMobile: 'no', resourceRoute: '/services/[^/]+' });
  assert.throws(() => validateOptions(opts), (err) => {
    assert.match(err.message, /placement must be one of "breadcrumb-row", "none", got "navbar"/);
    assert.match(err.message, /askAi must be "auto", true or false/);
    assert.match(err.message, /showOnMobile must be a boolean/);
    assert.match(err.message, /resourceRoute must have a capture group/);
    return true;
  });
  assert.throws(() => validateOptions(normalizeOptions({ resourceRoute: '(' })), /not a valid regular expression/);
});

test('the plugin module exports no validateOptions (Docusaurus would call it as its own hook)', () => {
  assert.equal(plugin.validateOptions, undefined);
});

test('plugin order: after the AEO plugin, or under themes, is accepted', () => {
  assert.equal(pluginOrderError(context([AEO, SELF]).siteConfig), null);
  assert.equal(pluginOrderError(context([[AEO, {}], [SELF, {}]]).siteConfig), null);
  assert.equal(pluginOrderError(context([AEO], [SELF]).siteConfig), null);
  assert.equal(pluginOrderError(context([SELF]).siteConfig), null);
  // A resolved path to the package counts as the package.
  assert.equal(pluginOrderError(context([AEO, path.join('node_modules', SELF, 'src', 'index.js')]).siteConfig), null);
});

test('plugin order: before the AEO plugin is an error, unless AEO has no breadcrumb row', () => {
  assert.match(pluginOrderError(context([SELF, AEO]).siteConfig), /list this plugin after @stackql\/docusaurus-plugin-aeo/);
  assert.match(pluginOrderError(context([], [SELF, AEO]).siteConfig), /after/);
  assert.throws(() => plugin(context([SELF, AEO]), {}), /list this plugin after/);
  assert.equal(pluginOrderError(context([SELF, [AEO, { askAi: { enabled: false } }]]).siteConfig), null);
  assert.equal(pluginOrderError(context([SELF, [AEO, { askAi: { placement: 'none' } }]]).siteConfig), null);
  // With placement 'none' this plugin has no row, so the order does not matter.
  assert.doesNotThrow(() => plugin(context([SELF, AEO]), { placement: 'none' }));
});

test('placement breadcrumb-row: a theme and the Ask AI alias; none: neither', () => {
  const p = plugin(context(), {});
  assert.equal(p.name, SELF);
  assert.equal(p.getThemePath(), path.resolve(__dirname, '..', 'src', 'theme'));
  assert.equal(typeof p.configureWebpack, 'function');

  const off = plugin(context(), { placement: 'none' });
  assert.equal(off.getThemePath, undefined);
  assert.equal(off.configureWebpack, undefined);
});

test('the Ask AI alias points at @theme/AskAiButton when there is one', () => {
  const askAiFile = path.join('node_modules', AEO, 'src', 'theme', 'AskAiButton', 'index.jsx');
  const config = { resolve: { alias: { '@theme/AskAiButton': askAiFile } } };
  const alias = (opts, cfg) => plugin(context(), opts).configureWebpack(cfg).resolve.alias[plugin.ASK_AI_ALIAS];

  assert.equal(alias({}, config), askAiFile);
  assert.equal(alias({ askAi: true }, config), askAiFile);
  // askAi false, or no AskAiButton registered: the component that renders nothing.
  assert.equal(alias({ askAi: false }, config), plugin.NO_ASK_AI);
  assert.equal(alias({}, { resolve: { alias: {} } }), plugin.NO_ASK_AI);
  assert.equal(alias({}, {}), plugin.NO_ASK_AI);
  assert.throws(() => alias({ askAi: true }, { resolve: { alias: {} } }), /askAi is true but no @theme\/AskAiButton/);
});

test('global data for the theme components', async () => {
  let data;
  await plugin(context(), { showOnMobile: true }).contentLoaded({
    actions: { setGlobalData: (d) => { data = d; } },
  });
  assert.deepEqual(data, { resourceRoute: DEFAULT_RESOURCE_ROUTE, showOnMobile: true });
});
