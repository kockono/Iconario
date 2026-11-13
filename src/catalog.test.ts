import { describe, expect, it } from 'vitest';
import { allIcons, getIcon, searchIcons } from './catalog';

describe('local icon catalog', () => {
  it('provides namespaced, collision-free icons from every requested collection', () => {
    expect(allIcons).toHaveLength(5298);
    expect(new Set(allIcons.map((icon) => icon.id)).size).toBe(allIcons.length);
    for (const id of [
      'fa-solid/house',
      'fa-regular/heart',
      'fa-brands/github',
      'remix/home-line',
      'remix/home-fill',
    ]) {
      const record = getIcon(id);
      expect(record?.id).toBe(id);
      expect(record?.svg).toMatch(/^<svg\b/);
      expect(record?.svg).toContain('currentColor');
      expect(record?.svg?.replace(' xmlns="http://www.w3.org/2000/svg"', '')).not.toMatch(/<script|onload=|javascript:|https?:\/\//i);
    }
    expect(getIcon('fa-solid/not-a-real-icon')).toBeUndefined();
  });

  it('declares the canonical SVG namespace in every generated icon', () => {
    expect(allIcons.every((icon) => /^<svg\s[^>]*\bxmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(icon.svg))).toBe(true);
  });

  it('searches a bounded, collection-filtered result set deterministically', () => {
    const all = searchIcons('home', undefined, 8);
    expect(all.length).toBeGreaterThan(0);
    expect(all.length).toBeLessThanOrEqual(8);
    expect(searchIcons('home', undefined, 8)).toEqual(all);
    const remix = searchIcons('home', 'remix', 5);
    expect(remix.length).toBeGreaterThan(0);
    expect(remix.every((item) => item.collection === 'remix')).toBe(true);
    expect(searchIcons('', undefined, 3)).toHaveLength(3);
    expect(searchIcons('', undefined, 0)).toEqual([]);
  });
});
