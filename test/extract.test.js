const test = require('node:test');
const assert = require('node:assert/strict');
const { extractSections } = require('../src/extract');
const { el, codeBlock, tabs, page } = require('./helpers/fakeDom');

test('each example section is read; code lines keep their line breaks', () => {
  const doc = page([
    { id: 'select-examples', content: [tabs([{ label: 'get', sql: 'SELECT a,\nb\nFROM p.s.r\nWHERE id = 1;' }])] },
    { id: 'insert-examples', content: [tabs([{ label: 'create', sql: 'INSERT INTO p.s.r (a)\nSELECT 1;' }])] },
    { id: 'update-examples', content: [tabs([{ label: 'update', sql: 'UPDATE p.s.r SET a = 1;' }])] },
    { id: 'replace-examples', content: [tabs([{ label: 'replace', sql: 'REPLACE p.s.r SET a = 1;' }])] },
    { id: 'delete-examples', content: [tabs([{ label: 'delete', sql: 'DELETE FROM p.s.r;' }])] },
  ]);
  assert.deepEqual(extractSections(doc), {
    select: 'SELECT a,\nb\nFROM p.s.r\nWHERE id = 1;',
    insert: 'INSERT INTO p.s.r (a)\nSELECT 1;',
    update: 'UPDATE p.s.r SET a = 1;',
    replace: 'REPLACE p.s.r SET a = 1;',
    delete: 'DELETE FROM p.s.r;',
  });
});

test('SELECT: the get tab is preferred wherever it is, then the first tab', () => {
  const withGetSecond = page([
    { id: 'select-examples', content: [tabs([{ label: 'list', sql: 'LIST' }, { label: 'get', sql: 'GET' }])] },
  ]);
  assert.equal(extractSections(withGetSecond).select, 'GET');

  const awsccLabels = page([
    {
      id: 'select-examples',
      content: [tabs([{ label: 'list (identifiers only)', sql: 'LIST' }, { label: 'get (all properties)', sql: 'GET' }])],
    },
  ]);
  assert.equal(extractSections(awsccLabels).select, 'GET');

  const noGet = page([{ id: 'select-examples', content: [tabs([{ label: 'list', sql: 'LIST' }, { label: 'search', sql: 'SEARCH' }])] }]);
  assert.equal(extractSections(noGet).select, 'LIST');
});

test('INSERT: All Properties, then create, never the Manifest tab when either exists', () => {
  const doc = page([
    {
      id: 'insert-example',
      content: [
        tabs([
          { label: 'Manifest', sql: 'YAML' },
          { label: 'Required Properties', sql: 'REQUIRED' },
          { label: 'All Properties', sql: 'ALL' },
        ]),
      ],
    },
  ]);
  assert.equal(extractSections(doc).insert, 'ALL');
  const create = page([{ id: 'insert-examples', content: [tabs([{ label: 'Manifest', sql: 'YAML' }, { label: 'create', sql: 'CREATE' }])] }]);
  assert.equal(extractSections(create).insert, 'CREATE');
});

test('a section without tabs: its first code block; a section ends at the next h2', () => {
  const doc = page([
    { id: 'update-example', content: [el('p', {}, [], 'Use the following'), codeBlock('UPDATE ONE'), codeBlock('UPDATE TWO')] },
    { id: 'delete-example', content: [codeBlock('DELETE ONE')] },
  ]);
  const sections = extractSections(doc);
  assert.equal(sections.update, 'UPDATE ONE');
  assert.equal(sections.delete, 'DELETE ONE');
  assert.equal(sections.select, undefined);
});

test('DELETE from the lifecycle methods: only from a delete tab', () => {
  const withDelete = page([
    { id: 'lifecycle-methods', content: [tabs([{ label: 'reboot', sql: 'EXEC REBOOT' }, { label: 'delete', sql: 'EXEC DELETE' }])] },
  ]);
  assert.equal(extractSections(withDelete).delete, 'EXEC DELETE');

  // Another lifecycle method is not a delete.
  const withoutDelete = page([
    { id: 'lifecycle-methods', content: [tabs([{ label: 'merge', sql: 'EXEC MERGE' }, { label: 'move', sql: 'EXEC MOVE' }])] },
  ]);
  assert.equal(extractSections(withoutDelete).delete, null);

  // A DELETE section wins over the lifecycle methods.
  const both = page([
    { id: 'delete-examples', content: [codeBlock('DELETE FROM t')] },
    { id: 'lifecycle-methods', content: [tabs([{ label: 'delete', sql: 'EXEC DELETE' }])] },
  ]);
  assert.equal(extractSections(both).delete, 'DELETE FROM t');
});
