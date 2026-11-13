// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { EditorState, StateEffect, StateField } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { createIconLivePreviewExtension, parseIconTokens, renderMarkdownTokens, tokenFor } from './markdown';

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><path d="M0 0h2v2H0z"/></svg>';
const lookup = (id: string) => id === 'fa-solid/house' ? svg : null;

describe('portable Markdown tokens', () => {
  it('defaults to source mode without a Live Preview predicate', () => {
    const source = 'A ' + tokenFor('fa-solid/house');
    const view = new EditorView({ doc: source, extensions: [createIconLivePreviewExtension(lookup)], parent: document.body });
    expect(view.dom.querySelectorAll('svg')).toHaveLength(0);
    expect(view.state.doc.toString()).toBe(source);
    view.destroy();
  });

  it('updates replacements when only the Live Preview mode changes', () => {
    const mode = StateEffect.define<boolean>();
    const live = StateField.define({ create: () => false, update: (value, transaction) => {
      for (const effect of transaction.effects) if (effect.is(mode)) value = effect.value;
      return value;
    } });
    const source = 'A ' + tokenFor('fa-solid/house');
    const view = new EditorView({ doc: source, extensions: [live, createIconLivePreviewExtension(lookup, state => state.field(live))], parent: document.body });
    expect(view.dom.querySelectorAll('svg')).toHaveLength(0);
    view.dispatch({ effects: mode.of(true) });
    expect(view.dom.querySelectorAll('svg')).toHaveLength(1);
    view.dispatch({ effects: mode.of(false) });
    expect(view.dom.querySelectorAll('svg')).toHaveLength(0);
    expect(view.state.doc.toString()).toBe(source);
    view.destroy();
  });
  it('formats and finds multiple exact tokens with source offsets', () => {
    expect(tokenFor('fa-solid/house')).toBe(':iconario[fa-solid/house]:');
    expect(parseIconTokens('A :iconario[fa-solid/house]: B :iconario[ri/home-line]:')).toEqual([
      { id: 'fa-solid/house', from: 2, to: 28 },
      { id: 'ri/home-line', from: 31, to: 55 },
    ]);
    expect(parseIconTokens(':iconario[bad]: :iconario[fa-solid/house] :iconario[fa-solid/house]:x')).toHaveLength(1);
  });

  it('renders known tokens in text only and leaves unknown and code untouched', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>A :iconario[fa-solid/house]: and :iconario[fa-solid/unknown]:</p><pre>:iconario[fa-solid/house]:</pre><code>:iconario[fa-solid/house]:</code>';
    renderMarkdownTokens(root, lookup);
    expect(root.querySelectorAll('svg')).toHaveLength(1);
    expect(root.querySelector('svg')?.getAttribute('aria-label')).toBe('fa-solid/house');
    expect(root.querySelector('p')?.textContent).toContain(':iconario[fa-solid/unknown]:');
    expect(root.querySelector('pre')?.textContent).toBe(':iconario[fa-solid/house]:');
    expect(root.querySelector('code')?.textContent).toBe(':iconario[fa-solid/house]:');
  });

  it.each([
    '    :iconario[fa-solid/house]:',
    '> ```\n> :iconario[fa-solid/house]:\n> ```',
    '`first\n:iconario[fa-solid/house]:\nlast`',
    'x'.repeat(100) + ' `:iconario[fa-solid/house]:`',
  ])('leaves Markdown code unchanged: %s', source => {
    const view = new EditorView({ state: EditorState.create({ doc: source, extensions: [createIconLivePreviewExtension(lookup, () => true)] }), parent: document.body });
    expect(view.dom.querySelectorAll('svg')).toHaveLength(0);
    expect(view.state.doc.toString()).toBe(source);
    view.destroy();
  });

  it('decorates Live Preview but preserves the document and skips code syntax', () => {
    const source = 'Start :iconario[fa-solid/house]:\n` :iconario[fa-solid/house]: `\n```\n:iconario[fa-solid/house]:\n```\n:iconario[fa-solid/unknown]:';
    const view = new EditorView({ state: EditorState.create({ doc: source, extensions: [createIconLivePreviewExtension(lookup, () => true)] }), parent: document.body });
    expect(view.dom.querySelectorAll('svg')).toHaveLength(1);
    expect(view.state.doc.toString()).toBe(source);
    view.destroy();
  });
});
