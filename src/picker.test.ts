import { afterEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { IconPicker, validateAppearance } from './picker';

const icons = [
  { id: 'fa-solid/house', name: 'house', collection: 'fa-solid', svg: '<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>' },
  { id: 'remix/home-line', name: 'home-line', collection: 'remix', svg: '<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>' },
];
const dom = new JSDOM('<!doctype html><html><body></body></html>');
afterEach(() => { dom.window.document.body.replaceChildren(); });

describe('picker', () => {
  it('validates bounded size and CSS color', () => {
    expect(validateAppearance('#aabbcc', 24)).toEqual({ color: '#aabbcc', size: 24 });
    expect(validateAppearance('red;url(x)', 500)).toEqual({ color: 'currentColor', size: 20 });
  });

  it('filters a bounded result set and selects by keyboard', () => {
    const selected = vi.fn();
    const root = dom.window.document.createElement('div');
    dom.window.document.body.append(root);
    const picker = new IconPicker(root, icons, { onSelect: selected, favorites: [], recents: [] });
    picker.mount();
    const input = root.querySelector('input[type="search"]') as HTMLInputElement;
    input.value = 'home';
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    expect(root.querySelectorAll('[data-icon-id]')).toHaveLength(1);
    input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(selected).toHaveBeenCalledWith('remix/home-line', expect.any(Object));
  });

  it('supports collection filter and favorites', () => {
    const root = dom.window.document.createElement('div');
    const picker = new IconPicker(root, icons, { onSelect: vi.fn(), favorites: ['fa-solid/house'], recents: [] });
    picker.mount();
    const filter = root.querySelector('select') as HTMLSelectElement;
    filter.value = 'favorites';
    filter.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    expect([...root.querySelectorAll('[data-icon-id]')].map(el => el.getAttribute('data-icon-id'))).toEqual(['fa-solid/house']);
  });

  it('starts preview with saved appearance', () => {
    const root = dom.window.document.createElement('div');
    new IconPicker(root, icons, { onSelect: vi.fn(), favorites: [], recents: [], appearance: { color: '#aabbcc', size: 32 } }).mount();
    expect((root.querySelector('input[type="number"]') as HTMLInputElement).value).toBe('32');
  });
});
