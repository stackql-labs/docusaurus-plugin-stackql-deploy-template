const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildTemplate,
  parseConditions,
  parseSelectSql,
  parseInsertValues,
  resourceNameFor,
  splitOnAnd,
  withAnchor,
} = require('../src/template');
const fixtures = require('./helpers/fixtures');

const jira = fixtures.jiraVersions;
const awscc = fixtures.awsccLogGroups;

// The anchors of a template, in order.
const anchorsOf = (template) => [...template.matchAll(/^\/\*\+ ([a-z]+)/gm)].map((m) => m[1]);
// The statement that follows an anchor, up to the next anchor.
const blockOf = (template, anchor) => {
  const start = template.indexOf(`/*+ ${anchor}`);
  const next = template.indexOf('\n/*+ ', start + 1);
  return template.slice(start, next === -1 ? undefined : next).trim();
};

test('awscc pages: the template is the one the site component built before the plugin', () => {
  const template = buildTemplate({
    select: awscc.select,
    insert: awscc.insert,
    update: awscc.update,
    delete: awscc.delete,
  });
  assert.equal(template, fixtures.awsccLogGroupsTemplateBeforePlugin);
});

test('provider-utils pages: every operation gets its stackql-deploy anchor', () => {
  const template = buildTemplate({
    select: jira.selectGet,
    insert: jira.insert,
    update: jira.update,
    delete: jira.delete,
  });
  assert.deepEqual(anchorsOf(template), ['exists', 'create', 'update', 'statecheck', 'exports', 'delete']);
  // The examples follow their anchors as the page writes them.
  assert.equal(blockOf(template, 'create'), `/*+ create */\n${jira.insert}`);
  assert.equal(blockOf(template, 'update'), `/*+ update */\n${jira.update}`);
  assert.equal(blockOf(template, 'delete'), `/*+ delete */\n${jira.delete}`);
});

test('provider-utils pages: generated queries use the required conditions only, without comments', () => {
  const template = buildTemplate({ select: jira.selectGet, insert: jira.insert });
  assert.equal(
    blockOf(template, 'exists'),
    "/*+ exists */\nSELECT count(*) as count\nFROM jira.projects.versions\nWHERE id = '{{ id }}' AND\ncloud_id = '{{ cloud_id }}'\n;",
  );
  const exportsBlock = blockOf(template, 'exports');
  assert.match(exportsBlock, /\nFROM jira\.projects\.versions\nWHERE id = '\{\{ id \}\}' AND\ncloud_id = '\{\{ cloud_id \}\}';$/);
  for (const anchor of ['exists', 'statecheck', 'exports']) {
    const block = blockOf(template, anchor);
    assert.doesNotMatch(block, /--/, `${anchor} has no comment to swallow the AND after it`);
    assert.doesNotMatch(block, /expand|start_at|max_results/, `${anchor} does not pin optional parameters`);
  }
});

test('provider-utils pages: the statecheck compares the settable columns with the INSERT values', () => {
  const template = buildTemplate({ select: jira.selectGet, insert: jira.insert });
  const statecheck = blockOf(template, 'statecheck');
  assert.ok(statecheck.startsWith('/*+ statecheck, retries=5, retry_delay=10 */\nSELECT count(*) as count\nFROM jira.projects.versions\nWHERE \n'));
  // Strings quoted and numbers and booleans bare, as the INSERT writes them.
  assert.match(statecheck, /^name = '\{\{ name \}\}' AND$/m);
  assert.match(statecheck, /^project_id = \{\{ project_id \}\} AND$/m);
  assert.match(statecheck, /^released = \{\{ released \}\} AND$/m);
  // Read-only columns (not in the INSERT) are not compared.
  assert.doesNotMatch(statecheck, /overdue|self =/);
  assert.match(statecheck, /cloud_id = '\{\{ cloud_id \}\}'\n;$/);
});

test('an UPDATE example is preferred to a REPLACE example', () => {
  assert.match(buildTemplate({ update: 'UPDATE t SET a = 1', replace: 'REPLACE t SET a = 1' }), /^\/\*\+ update \*\/\nUPDATE/);
  assert.match(buildTemplate({ replace: 'REPLACE t SET a = 1' }), /^\/\*\+ update \*\/\nREPLACE/);
});

test('a page without a SELECT example has no exists, statecheck or exports', () => {
  const template = buildTemplate({ insert: jira.insert, delete: jira.delete });
  assert.deepEqual(anchorsOf(template), ['create', 'delete']);
});

test('a page with no examples has an empty template', () => {
  assert.equal(buildTemplate({}), '');
});

test('an example that starts with an anchor keeps it', () => {
  assert.equal(withAnchor('/*+ create */\nINSERT INTO t (a) SELECT 1', 'create'), '/*+ create */\nINSERT INTO t (a) SELECT 1');
  assert.equal(withAnchor('  /*+ createorupdate */\nINSERT', 'create'), '  /*+ createorupdate */\nINSERT');
  assert.equal(withAnchor('DELETE FROM t', 'delete'), '/*+ delete */\nDELETE FROM t');
});

test('parseConditions: comments dropped, required kept when marked, all kept when not', () => {
  assert.deepEqual(
    parseConditions("a = '{{ a }}' -- required\nAND b = '{{ b }}' --required unless B is set\nAND c = '{{ c }}'"),
    ["a = '{{ a }}'", "b = '{{ b }}'"],
  );
  assert.deepEqual(parseConditions("\n  region = '{{ region }}' AND\n  Identifier = '{{ id }}'"), [
    "region = '{{ region }}'",
    "Identifier = '{{ id }}'",
  ]);
  // `--` and AND inside a quoted value are part of the value.
  assert.deepEqual(parseConditions("a = 'x -- y' AND b = 'q and a'"), ["a = 'x -- y'", "b = 'q and a'"]);
});

test('splitOnAnd: only the keyword, not a word that contains it', () => {
  assert.deepEqual(splitOnAnd('brand = 1 AND operand = 2 and x = 3'), ['brand = 1', 'operand = 2', 'x = 3']);
});

test('parseSelectSql reads the columns, the table and the conditions', () => {
  const parsed = parseSelectSql(jira.selectList);
  assert.equal(parsed.table, 'jira.projects.versions');
  assert.equal(parsed.fields[0], 'id');
  assert.ok(parsed.fields.includes('user_start_date'));
  assert.deepEqual(parsed.conditions, ["project_id_or_key = '{{ project_id_or_key }}'", "cloud_id = '{{ cloud_id }}'"]);
  assert.deepEqual(parseSelectSql('SELECT * FROM x.y.z').fields, []);
});

test('parseInsertValues pairs each column with its value, without the /* required */ markers', () => {
  const values = parseInsertValues(
    "INSERT INTO ovh.cloud.sshkeys (\nname,\npublic_key,\nregion\n)\nSELECT \n'{{ name }}' /* required */,\n'{{ public_key }}' /* required */,\n'{{ region }}'\nRETURNING\nid\n;",
  );
  assert.deepEqual(values, { name: "'{{ name }}'", public_key: "'{{ public_key }}'", region: "'{{ region }}'" });
  assert.equal(parseInsertValues(jira.insert).project_id, '{{ project_id }}');
  // Columns and values that do not line up give no values.
  assert.deepEqual(parseInsertValues('INSERT INTO t (a, b) SELECT 1;'), {});
});

test('resourceNameFor: the resource segment of a resource page, null elsewhere', () => {
  assert.equal(resourceNameFor('/services/projects/versions/'), 'versions');
  assert.equal(resourceNameFor('/services/projects/versions'), 'versions');
  assert.equal(resourceNameFor('/de/services/projects/versions'), 'versions');
  assert.equal(resourceNameFor('/services/projects/'), null);
  assert.equal(resourceNameFor('/'), null);
  assert.equal(resourceNameFor('/providers/jira/projects/versions', '/providers/[^/]+/[^/]+/([^/]+)'), 'versions');
});
