const path = require('path');
const {
  PLUGIN_NAME,
  AEO_PLUGIN_NAME,
  normalizeOptions,
  validateOptions,
  pluginOrderError,
} = require('./options');

// The module the breadcrumb row imports for the Ask AI button. configureWebpack
// points it at the site's @theme/AskAiButton (from @stackql/docusaurus-plugin-aeo
// or a site swizzle) or, when there is none or askAi is false, at a component
// that renders nothing.
const ASK_AI_ALIAS = '@stackql-deploy-template/AskAiButton';
const NO_ASK_AI = path.resolve(__dirname, 'client', 'NoAskAiButton.js');

/**
 * The webpack alias for the Ask AI button, from the theme aliases of the
 * base config (where '@theme/AskAiButton' is when a plugin or the site
 * provides the component).
 */
function askAiAlias(config, askAi) {
  const alias = (config && config.resolve && config.resolve.alias) || {};
  const askAiButton = Array.isArray(alias) ? undefined : alias['@theme/AskAiButton'];
  if (askAi === true && !askAiButton) {
    throw new Error(
      `[${PLUGIN_NAME}] askAi is true but no @theme/AskAiButton component is registered: ` +
        `add ${AEO_PLUGIN_NAME} with Ask AI enabled, or set askAi to "auto" or false`,
    );
  }
  return { [ASK_AI_ALIAS]: askAi !== false && askAiButton ? askAiButton : NO_ASK_AI };
}

function pluginStackqlDeployTemplate(context, rawOptions) {
  const options = normalizeOptions(rawOptions);
  validateOptions(options);

  const enabled = options.placement !== 'none';
  if (enabled) {
    const orderError = pluginOrderError(context && context.siteConfig);
    if (orderError) throw new Error(orderError);
  }

  const plugin = {
    name: PLUGIN_NAME,

    // Read by the theme components with usePluginData(PLUGIN_NAME).
    async contentLoaded({ actions }) {
      await actions.setGlobalData({
        resourceRoute: options.resourceRoute,
        showOnMobile: options.showOnMobile,
      });
    },
  };

  // With placement 'none' the plugin contributes no theme, so no
  // DocBreadcrumbs override and no menu; omitting getThemePath is how a
  // plugin says so (returning undefined from it fails the build).
  if (enabled) {
    plugin.getThemePath = () => path.resolve(__dirname, './theme');
    plugin.configureWebpack = (config) => ({
      resolve: { alias: askAiAlias(config, options.askAi) },
    });
  }

  return plugin;
}

module.exports = pluginStackqlDeployTemplate;
// Intentionally no validateOptions export (see src/options.js). The helpers
// below are for the tests; Docusaurus reads only the default export.
module.exports.askAiAlias = askAiAlias;
module.exports.ASK_AI_ALIAS = ASK_AI_ALIAS;
module.exports.NO_ASK_AI = NO_ASK_AI;
