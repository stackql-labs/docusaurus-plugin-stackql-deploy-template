const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { extractAllSourceCodeFileTranslations, getBabelOptions } = require('@docusaurus/babel');
const { loadTheme, THEME_DIR } = require('./helpers/renderTheme');

const h = React.createElement;
// MUI inlines its styles next to the elements; drop them.
const strip = (html) => html.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '');

function loadTemplateMenu({ pathname, data = {} }) {
  return loadTheme('StackqlDeployTemplate/index.jsx', {
    '@docusaurus/router': { useLocation: () => ({ pathname }) },
    '@docusaurus/useGlobalData': { usePluginData: () => data },
    '@docusaurus/Translate': { translate: ({ message }) => message },
  }).default;
}

function renderTemplateMenu(opts) {
  return strip(renderToStaticMarkup(h(loadTemplateMenu(opts))));
}

test('the template menu renders on a resource page and nothing elsewhere', () => {
  const html = renderTemplateMenu({ pathname: '/services/projects/versions' });
  assert.match(html, /<button[^>]*aria-haspopup="menu"[^>]*>stackql-deploy Template/);
  assert.equal(renderTemplateMenu({ pathname: '/services/projects/' }), '');
  assert.equal(renderTemplateMenu({ pathname: '/' }), '');
});

test('the template menu is hidden below the desktop breakpoint unless showOnMobile', () => {
  // CSS modules are a class-name proxy in these tests: the class is the key.
  assert.match(renderTemplateMenu({ pathname: '/services/a/b' }), /^<div class="wrapper">/);
  assert.match(renderTemplateMenu({ pathname: '/services/a/b', data: { showOnMobile: true } }), /^<div class="wrapperAllViewports">/);
});

test('the route pattern comes from the plugin options', () => {
  const data = { resourceRoute: '/reference/[^/]+/([^/]+)' };
  assert.match(renderTemplateMenu({ pathname: '/reference/projects/versions', data }), /stackql-deploy Template/);
  assert.equal(renderTemplateMenu({ pathname: '/services/projects/versions', data }), '');
});

test('the breadcrumb row: breadcrumbs, then Ask AI and the template menu grouped on the right', () => {
  const Row = loadTheme('DocBreadcrumbs/index.jsx', {
    '@theme-init/DocBreadcrumbs': { __esModule: true, default: () => h('nav', null, 'crumbs') },
    '@stackql-deploy-template/AskAiButton': { __esModule: true, default: () => h('button', null, 'Ask AI') },
    '@theme/StackqlDeployTemplate': { __esModule: true, default: () => h('button', null, 'Template') },
  }).default;
  assert.equal(
    renderToStaticMarkup(h(Row)),
    '<div class="row"><nav>crumbs</nav><div class="actions"><button>Ask AI</button><button>Template</button></div></div>',
  );
});

test('the visible strings are extracted by `docusaurus write-translations`', async () => {
  const file = path.join(THEME_DIR, 'StackqlDeployTemplate', 'index.jsx');
  const [result] = await extractAllSourceCodeFileTranslations([file], getBabelOptions({ isServer: true }));
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    Object.fromEntries(Object.entries(result.translations).map(([id, t]) => [id, t.message])),
    {
      'stackqlDeployTemplate.button': 'stackql-deploy Template',
      'stackqlDeployTemplate.download': 'Download',
      'stackqlDeployTemplate.copied': 'Copied!',
      'stackqlDeployTemplate.copy': 'Copy',
    },
  );
});
