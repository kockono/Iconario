/** Make.md 1.3.5 adapter. Its AssetManager is internal, so every access is guarded. */
export interface BridgeIcon {
  id: string;
  name: string;
  svg: string;
  collection: string;
}

interface IconsetAsset {
  id: string;
  name: string;
  path: string;
  type: 'iconset';
  format: 'svg';
  icons: { id: string; name: string }[];
}

interface AssetManager {
  iconsCache: Map<string, string>;
  getAsset(id: string): unknown;
  getIconsets(): unknown[];
  getIconSync(key: string): string | undefined;
  updateAsset(asset: IconsetAsset): Promise<boolean>;
  deleteAsset(id: string): Promise<boolean>;
}

interface MakePlugin {
  manifest?: { version?: string };
  superstate?: { assets?: AssetManager };
}

const PACKS: Record<string, string> = {
  'fa-solid': 'Font Awesome Free Solid',
  'fa-regular': 'Font Awesome Free Regular',
  'fa-brands': 'Font Awesome Free Brands',
  remix: 'Remix Icon',
};

const ICON_ID = /^(fa-solid|fa-regular|fa-brands|remix)\/([a-z0-9][a-z0-9-]*)$/;

export function encodeSticker(id: string): string | null {
  const match = ICON_ID.exec(id);
  return match ? `iconario-${match[1]}//${match[2]}` : null;
}

export function decodeSticker(sticker: string): string | null {
  const match = /^iconario-(fa-solid|fa-regular|fa-brands|remix)\/\/([a-z0-9][a-z0-9-]*)$/.exec(sticker);
  return match ? `${match[1]}/${match[2]}` : null;
}

export function restoreOwnedValue(current: unknown, written: string, previous: unknown): unknown {
  return current === written ? previous : current;
}

function supported(plugin: MakePlugin | null | undefined): AssetManager | null {
  if (plugin?.manifest?.version !== '1.3.5') return null;
  const manager = plugin.superstate?.assets;
  if (!manager || !(manager.iconsCache instanceof Map) ||
      typeof manager.getAsset !== 'function' || typeof manager.getIconsets !== 'function' ||
      typeof manager.getIconSync !== 'function' || typeof manager.updateAsset !== 'function' ||
      typeof manager.deleteAsset !== 'function') return null;
  return manager;
}

export class MakeMdBridge {
  private manager: AssetManager | null = null;
  private owned = new Map<string, IconsetAsset>();
  private cached = new Map<string, string>();
  private cancelled = false;
  private pending: Promise<boolean> | null = null;
  private cleaning: Promise<void> | null = null;

  constructor(private readonly getPlugin: () => MakePlugin | null | undefined,
              private readonly icons: readonly BridgeIcon[]) {}

  register(): Promise<boolean> {
    if (this.cleaning) return this.cleaning.then(() => this.register());
    if (this.pending) return this.pending;
    if (this.manager) return Promise.resolve(true);
    this.cancelled = false;
    this.pending = this.registerAssets().finally(() => { this.pending = null; });
    return this.pending;
  }

  private async registerAssets(): Promise<boolean> {
    const manager = supported(this.getPlugin());
    if (!manager) return false;
    const groups = new Map<string, BridgeIcon[]>();
    for (const icon of this.icons) {
      const sticker = encodeSticker(icon.id);
      if (!sticker || !icon.svg.startsWith('<svg ') || /<script|on\w+=|<foreignObject/i.test(icon.svg)) return false;
      const group = groups.get(icon.collection) ?? [];
      group.push(icon);
      groups.set(icon.collection, group);
    }
    for (const pack of groups.keys()) {
      if (!PACKS[pack] || manager.getAsset(`iconario-${pack}`)) return false;
    }
    this.manager = manager;
    try {
      for (const [pack, packIcons] of groups) {
        const asset: IconsetAsset = {
          id: `iconario-${pack}`, name: PACKS[pack], path: '', type: 'iconset', format: 'svg',
          icons: packIcons.map(({ id, name }) => ({ id: id.split('/')[1], name })),
        };
        if (!await manager.updateAsset(asset)) throw new Error('Make.md refused asset');
        this.owned.set(asset.id, asset);
        if (this.cancelled) throw new Error('Make.md registration cancelled');
        for (const icon of packIcons) {
          const key = encodeSticker(icon.id)!;
          // Refuse to replace unrelated cache entries.
          if (manager.iconsCache.has(key)) throw new Error('Make.md cache collision');
          manager.iconsCache.set(key, icon.svg);
          this.cached.set(key, icon.svg);
        }
      }
      return true;
    } catch {
      await this.cleanupAssets();
      return false;
    }
  }

  unregister(): Promise<void> {
    this.cancelled = true;
    if (this.cleaning) return this.cleaning;
    this.cleaning = (async () => {
      await this.pending;
      await this.cleanupAssets();
    })().finally(() => { this.cleaning = null; });
    return this.cleaning;
  }

  private async cleanupAssets(): Promise<void> {
    const manager = this.manager;
    if (!manager) return;
    for (const [key, svg] of this.cached) {
      if (manager.iconsCache.get(key) === svg) manager.iconsCache.delete(key);
    }
    for (const [id, asset] of this.owned) {
      if (manager.getAsset(id) === asset) await manager.deleteAsset(id);
    }
    this.cached.clear();
    this.owned.clear();
    this.manager = null;
  }

  isActive(): boolean { return this.manager !== null && !this.cancelled; }
}
