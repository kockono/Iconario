import { RangeSetBuilder, type EditorState, type Extension } from '@codemirror/state';
import { parser } from '@lezer/markdown';
import { Decoration, EditorView, ViewPlugin, WidgetType, type ViewUpdate } from '@codemirror/view';

export interface IconToken { id: string; from: number; to: number }
export type IconLookup = (id: string) => string | null | undefined;

const TOKEN = /:iconario\[([a-z][a-z0-9-]*\/[a-z0-9][a-z0-9-]*)\]:/g;
const ID = /^[a-z][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/;
const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set(['svg', 'g', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse']);
const SVG_ATTRIBUTES = new Set(['viewBox', 'xmlns', 'd', 'fill', 'fill-rule', 'clip-rule', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'cx', 'cy', 'r', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'points', 'rx', 'ry', 'transform']);

export function tokenFor(id: string): string {
  if (!ID.test(id)) throw new Error(`Invalid icon id: ${id}`);
  return `:iconario[${id}]:`;
}

export function parseIconTokens(text: string): IconToken[] {
  return Array.from(text.matchAll(TOKEN), match => ({
    id: match[1],
    from: match.index,
    to: match.index + match[0].length,
  }));
}

function trustedSvg(markup: string, id: string): SVGElement | null {
  const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const source = parsed.documentElement;
  if (source.localName !== 'svg' || source.namespaceURI !== SVG_NS) return null;
  const copy = (element: Element): SVGElement | null => {
    if (!SVG_TAGS.has(element.localName) || element.namespaceURI !== SVG_NS) return null;
    const target = document.createElementNS(SVG_NS, element.localName);
    for (const attr of Array.from(element.attributes)) {
      if (SVG_ATTRIBUTES.has(attr.name) && !/url\s*\(|javascript:/i.test(attr.value)) {
        target.setAttribute(attr.name, attr.value);
      }
    }
    for (const child of Array.from(element.children)) {
      const safe = copy(child);
      if (safe) target.append(safe);
    }
    return target;
  };
  const svg = copy(source);
  if (!svg) return null;
  svg.setAttribute('aria-label', id);
  svg.setAttribute('role', 'img');
  svg.classList.add('iconario-inline-icon');
  return svg;
}

export function renderMarkdownTokens(root: HTMLElement, lookup: IconLookup): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    if (node.parentElement?.closest('code, pre, script, style, svg, .iconario-inline-icon')) continue;
    const text = node.data;
    const tokens = parseIconTokens(text);
    if (!tokens.length) continue;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    let changed = false;
    for (const token of tokens) {
      const markup = lookup(token.id);
      const svg = markup ? trustedSvg(markup, token.id) : null;
      if (!svg) continue;
      fragment.append(document.createTextNode(text.slice(cursor, token.from)), svg);
      cursor = token.to;
      changed = true;
    }
    if (changed) {
      fragment.append(document.createTextNode(text.slice(cursor)));
      node.replaceWith(fragment);
    }
  }
}

interface Span { from: number; to: number }

function markdownCodeSpans(text: string): Span[] {
  const spans: Span[] = [];
  parser.parse(text).iterate({ enter(node) {
    if (node.name === 'FencedCode' || node.name === 'CodeBlock' || node.name === 'InlineCode') {
      spans.push({ from: node.from, to: node.to });
      return false;
    }
  } });
  return spans;
}

class IconWidget extends WidgetType {
  constructor(readonly id: string, readonly markup: string) { super(); }
  eq(other: IconWidget): boolean { return this.id === other.id && this.markup === other.markup; }
  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'iconario-live-icon';
    const svg = trustedSvg(this.markup, this.id);
    if (svg) span.append(svg);
    return span;
  }
}

function decorations(view: EditorView, lookup: IconLookup) {
  const source = view.state.doc.toString();
  const excluded = markdownCodeSpans(source);
  const builder = new RangeSetBuilder<Decoration>();
  for (const token of parseIconTokens(source)) {
    if (excluded.some(span => token.from < span.to && token.to > span.from)) continue;
    if (view.state.selection.ranges.some(range => range.empty
      ? range.from > token.from && range.from < token.to
      : range.from < token.to && range.to > token.from)) continue;
    const markup = lookup(token.id);
    if (!markup || !trustedSvg(markup, token.id)) continue;
    builder.add(token.from, token.to, Decoration.replace({ widget: new IconWidget(token.id, markup) }));
  }
  return builder.finish();
}

export function createIconLivePreviewExtension(lookup: IconLookup, isLivePreview: (state: EditorState) => boolean = () => false): Extension {
  return ViewPlugin.fromClass(class {
    decorations;
    constructor(view: EditorView) { this.decorations = isLivePreview(view.state) ? decorations(view, lookup) : Decoration.none; }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged || isLivePreview(update.startState) !== isLivePreview(update.state)) {
        this.decorations = isLivePreview(update.state) ? decorations(update.view, lookup) : Decoration.none;
      }
    }
  }, { decorations: plugin => plugin.decorations });
}
