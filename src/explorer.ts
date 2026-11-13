const ROW_SELECTOR = '.nav-file-title[data-path], .nav-folder-title[data-path]';
const ICON_CLASS = 'iconario-explorer-icon';
const SVG_NS = 'http://www.w3.org/2000/svg';

/** Adds only Iconario-owned decoration and never replaces Obsidian's row controls. */
export class NativeExplorerDecorator {
  private observer?: MutationObserver;
  private timer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly root: HTMLElement,
    private readonly getAssignment: (path: string) => string | undefined,
    private readonly getSvg: (iconId: string) => string | undefined,
  ) {}

  start(): void {
    if (this.observer) return;
    this.refresh();
    this.observer = new MutationObserver(mutations => {
      // Our own icon insertion/removal must not schedule another pass forever.
      if (mutations.every(mutation => {
        if (mutation.type !== 'childList') return false;
        const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
        return nodes.length > 0 && nodes.every(node =>
          node instanceof Element && node.classList.contains(ICON_CLASS));
      })) return;
      this.scheduleRefresh();
    });
    this.observer.observe(this.root, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-path'] });
  }

  refresh(): void {
    for (const row of this.root.querySelectorAll<HTMLElement>(ROW_SELECTOR)) {
      const path = row.dataset.path;
      const iconId = path ? this.getAssignment(path) : undefined;
      const svg = iconId ? this.getSvg(iconId) : undefined;
      const existing = row.querySelector<HTMLElement>(`:scope > .${ICON_CLASS}`);
      if (!svg || !iconId) {
        existing?.remove();
        continue;
      }
      if (existing?.dataset.iconId === iconId) continue;
      const icon = createIcon(svg, iconId);
      if (!icon) {
        existing?.remove();
        continue;
      }
      existing?.remove();
      const title = row.querySelector(':scope > .nav-file-title-content, :scope > .nav-folder-title-content');
      row.insertBefore(icon, title ?? row.firstChild);
    }
  }

  destroy(): void {
    this.observer?.disconnect();
    this.observer = undefined;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    for (const icon of this.root.querySelectorAll(`.${ICON_CLASS}`)) icon.remove();
  }

  private scheduleRefresh(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.refresh();
    }, 32);
  }
}

function createIcon(source: string, iconId: string): HTMLElement | undefined {
  const parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
  const svg = parsed.documentElement;
  if (svg.localName !== 'svg' || svg.namespaceURI !== SVG_NS) return undefined;
  // The lookup is local, but reject active SVG content as a defense in depth.
  for (const node of [svg, ...svg.querySelectorAll('*')]) {
    if (['script', 'foreignObject', 'image', 'use', 'style', 'animate', 'set'].includes(node.localName)) {
      node.remove();
      continue;
    }
    for (const attribute of [...node.attributes]) {
      if (/^on/i.test(attribute.name) || /href/i.test(attribute.name) || attribute.name === 'style') {
        node.removeAttribute(attribute.name);
      }
    }
  }
  const wrapper = document.createElement('span');
  wrapper.className = ICON_CLASS;
  wrapper.dataset.iconId = iconId;
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.append(document.importNode(svg, true));
  return wrapper;
}
