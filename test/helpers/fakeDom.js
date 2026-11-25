// A minimal stand-in for the DOM of a rendered resource page: enough of
// getElementById, nextElementSibling, querySelector('pre code') and
// querySelectorAll('[role="..."]') for src/extract.js. No dependencies.
class El {
  constructor(tagName, attrs = {}, children = [], text = '') {
    this.tagName = tagName.toUpperCase();
    this.attrs = attrs;
    this.text = text;
    this.parent = null;
    this.childList = children;
    for (const c of children) c.parent = this;
  }

  get id() {
    return this.attrs.id;
  }

  get children() {
    return this.childList;
  }

  get textContent() {
    return this.text + this.childList.map((c) => c.textContent).join('');
  }

  get nextElementSibling() {
    if (!this.parent) return null;
    const siblings = this.parent.childList;
    return siblings[siblings.indexOf(this) + 1] || null;
  }

  *descendants() {
    for (const c of this.childList) {
      yield c;
      yield* c.descendants();
    }
  }

  querySelectorAll(selector) {
    const role = selector.match(/^\[role="([^"]+)"\]$/);
    if (!role) throw new Error(`fakeDom: unsupported selector ${selector}`);
    return [...this.descendants()].filter((e) => e.attrs.role === role[1]);
  }

  querySelector(selector) {
    if (selector !== 'pre code') throw new Error(`fakeDom: unsupported selector ${selector}`);
    for (const pre of this.descendants()) {
      if (pre.tagName !== 'PRE') continue;
      for (const code of pre.descendants()) if (code.tagName === 'CODE') return code;
    }
    return null;
  }
}

const el = (tag, attrs, children, text) => new El(tag, attrs, children, text);

// A code block as prism-react-renderer renders it: one element per line.
function codeBlock(sql) {
  return el('div', {}, [el('pre', {}, [el('code', {}, sql.split('\n').map((line) => el('span', {}, [], `${line}\n`)))])]);
}

// A Docusaurus <Tabs> block: [{ label, sql }].
function tabs(items) {
  return el('div', { class: 'tabs-container' }, [
    el('ul', { role: 'tablist' }, items.map((t) => el('li', { role: 'tab' }, [], t.label))),
    el('div', {}, items.map((t) => el('div', { role: 'tabpanel' }, [codeBlock(t.sql)]))),
  ]);
}

// A page: the markdown column with h2 sections. `sections` is
// [{ id, content: El[] }].
function page(sections) {
  const children = [];
  for (const s of sections) children.push(el('h2', { id: s.id }, [], s.id), ...s.content);
  const root = el('div', { class: 'markdown' }, children);
  return {
    getElementById(id) {
      for (const e of root.descendants()) if (e.id === id) return e;
      return null;
    },
  };
}

module.exports = { el, codeBlock, tabs, page };
