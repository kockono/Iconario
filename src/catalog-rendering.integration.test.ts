// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { getIcon } from './catalog';
import { renderMarkdownTokens, tokenFor } from './markdown';

it.each(['fa-solid/house', 'fa-regular/star', 'fa-brands/github', 'remix/home-line'])(
  'renders a real catalog SVG in reading mode: %s',
  id => {
    const icon = getIcon(id);
    expect(icon, 'the requested icon must exist in the bundled catalog').toBeDefined();
    const root = document.createElement('div');
    root.textContent = tokenFor(id);
    renderMarkdownTokens(root, candidate => getIcon(candidate)?.svg);
    const svg = root.querySelector('svg');
    expect(svg, 'real generated SVG must pass the renderer sanitizer').not.toBeNull();
    expect(svg?.namespaceURI).toBe('http://www.w3.org/2000/svg');
  },
);
