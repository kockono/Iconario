export interface PickerIcon { id: string; name: string; collection: string; svg: string }
export interface Appearance { color: string; size: number }
export interface PickerOptions {
  onSelect(id: string, appearance: Appearance): void;
  favorites: string[];
  recents: string[];
  appearance?: Appearance;
  onFavoritesChange?(favorites: string[]): void;
}

export function validateAppearance(color: string, size: number): Appearance {
  return {
    color: /^(#[0-9a-fA-F]{6}|currentColor)$/.test(color) ? color : 'currentColor',
    size: Number.isInteger(size) && size >= 12 && size <= 64 ? size : 20,
  };
}

function svgElement(document: Document, markup: string): SVGSVGElement | null {
  const Parser = document.defaultView?.DOMParser;
  if (!Parser) return null;
  const parsed = new Parser().parseFromString(markup, 'image/svg+xml');
  const svg = parsed.documentElement;
  if (svg.localName !== 'svg' || svg.namespaceURI !== 'http://www.w3.org/2000/svg' || parsed.querySelector('parsererror,script,foreignObject')) return null;
  return document.importNode(svg, true) as unknown as SVGSVGElement;
}

export class IconPicker {
  private query = '';
  private collection = 'all';
  private active = 0;
  private appearance: Appearance = { color: 'currentColor', size: 20 };
  private favorites: string[];
  private results: PickerIcon[] = [];
  private list!: HTMLElement;
  private preview!: HTMLElement;
  private input!: HTMLInputElement;

  constructor(private readonly root: HTMLElement, private readonly icons: readonly PickerIcon[],
              private readonly options: PickerOptions) {
    this.favorites = [...options.favorites];
    if (options.appearance) this.appearance = validateAppearance(options.appearance.color, options.appearance.size);
  }

  mount(): void {
    const doc = this.root.ownerDocument;
    this.root.replaceChildren();
    this.root.classList.add('iconario-picker');
    this.input = doc.createElement('input');
    this.input.type = 'search';
    this.input.placeholder = 'Buscar iconos';
    this.input.setAttribute('aria-label', 'Buscar iconos');
    this.input.addEventListener('input', () => { this.query = this.input.value.trim().toLowerCase(); this.active = 0; this.render(); });
    this.input.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        this.active = Math.max(0, Math.min(this.results.length - 1, this.active + (event.key === 'ArrowDown' ? 1 : -1)));
        this.renderSelection();
      } else if (event.key === 'Enter' && this.results[this.active]) {
        event.preventDefault();
        this.select(this.results[this.active]);
      }
    });
    const filter = doc.createElement('select');
    filter.setAttribute('aria-label', 'Colección');
    for (const [value, label] of [
      ['all', 'Todas'], ['fa-solid', 'Font Awesome Solid'], ['fa-regular', 'Font Awesome Regular'],
      ['fa-brands', 'Font Awesome Brands'], ['remix', 'Remix Icon'], ['favorites', 'Favoritos'], ['recents', 'Recientes'],
    ]) {
      const option = doc.createElement('option'); option.value = value; option.textContent = label; filter.append(option);
    }
    filter.addEventListener('change', () => { this.collection = filter.value; this.active = 0; this.render(); });
    const color = doc.createElement('input');
    color.type = 'color'; color.value = this.appearance.color === 'currentColor' ? '#000000' : this.appearance.color; color.setAttribute('aria-label', 'Color del icono');
    color.addEventListener('input', () => { this.appearance = validateAppearance(color.value, this.appearance.size); this.renderPreview(); });
    const size = doc.createElement('input');
    size.type = 'number'; size.min = '12'; size.max = '64'; size.value = String(this.appearance.size); size.setAttribute('aria-label', 'Tamaño del icono');
    size.addEventListener('change', () => { this.appearance = validateAppearance(this.appearance.color, Number(size.value)); size.value = String(this.appearance.size); this.renderPreview(); });
    this.list = doc.createElement('div'); this.list.className = 'iconario-results'; this.list.setAttribute('role', 'listbox');
    this.preview = doc.createElement('div'); this.preview.className = 'iconario-preview';
    this.root.append(this.input, filter, color, size, this.preview, this.list);
    this.render();
    this.input.focus();
  }

  private render(): void {
    const order = this.collection === 'favorites' ? this.favorites : this.collection === 'recents' ? this.options.recents : null;
    const source = order ? order.map(id => this.icons.find(icon => icon.id === id)).filter((icon): icon is PickerIcon => !!icon) : this.icons;
    this.results = [];
    for (const icon of source) {
      if (this.collection !== 'all' && !order && icon.collection !== this.collection) continue;
      if (this.query && !`${icon.id} ${icon.name}`.toLowerCase().includes(this.query)) continue;
      this.results.push(icon);
      if (this.results.length >= 100) break;
    }
    this.list.replaceChildren();
    this.results.forEach((icon, index) => {
      const button = this.root.ownerDocument.createElement('button');
      button.type = 'button'; button.dataset.iconId = icon.id; button.title = icon.id;
      button.setAttribute('role', 'option');
      const svg = svgElement(this.root.ownerDocument, icon.svg);
      if (svg) button.append(svg);
      const label = this.root.ownerDocument.createElement('span'); label.textContent = icon.name; button.append(label);
      button.addEventListener('click', () => this.select(icon));
      button.addEventListener('focus', () => { this.active = index; this.renderSelection(); });
      this.list.append(button);
    });
    this.renderSelection();
  }

  private renderSelection(): void {
    [...this.list.children].forEach((el, index) => el.setAttribute('aria-selected', String(index === this.active)));
    this.renderPreview();
  }

  private renderPreview(): void {
    this.preview.replaceChildren();
    const icon = this.results[this.active];
    if (!icon) { this.preview.textContent = 'Sin resultados'; return; }
    const svg = svgElement(this.root.ownerDocument, icon.svg);
    if (svg) {
      svg.setAttribute('style', `color:${this.appearance.color};width:${this.appearance.size}px;height:${this.appearance.size}px`);
      this.preview.append(svg);
    }
    const label = this.root.ownerDocument.createElement('span'); label.textContent = icon.id; this.preview.append(label);
    const favorite = this.root.ownerDocument.createElement('button'); favorite.type = 'button';
    favorite.textContent = this.favorites.includes(icon.id) ? 'Quitar de favoritos' : 'Añadir a favoritos';
    favorite.addEventListener('click', () => {
      this.favorites = this.favorites.includes(icon.id) ? this.favorites.filter(id => id !== icon.id) : [icon.id, ...this.favorites];
      this.options.onFavoritesChange?.([...this.favorites]);
      this.renderPreview();
    });
    this.preview.append(favorite);
  }

  private select(icon: PickerIcon): void { this.options.onSelect(icon.id, this.appearance); }
}
