import { describe, expect, it, vi } from 'vitest';
import { MakeMdBridge, encodeSticker, decodeSticker, restoreOwnedValue } from './makemd';

const icon = { id: 'fa-solid/house', name: 'house', svg: '<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>', collection: 'fa-solid' };

function fakeManager() {
  const assets = new Map<string, unknown>();
  return {
    assets,
    iconsCache: new Map<string, string>(),
    getAsset: (id: string) => assets.get(id) ?? null,
    getIconsets: () => [...assets.values()],
    getIconSync(key: string) { return this.iconsCache.get(key); },
    updateAsset: vi.fn(async (asset: { id: string }) => { assets.set(asset.id, asset); return true; }),
    deleteAsset: vi.fn(async (id: string) => assets.delete(id)),
  };
}

describe('Make.md bridge', () => {
  it('waits for a pending asset write on unregister and can register again without touching foreign resources', async () => {
    const manager = fakeManager();
    manager.assets.set('foreign-pack', { id: 'foreign-pack' });
    manager.iconsCache.set('other//icon', 'foreign-svg');
    let release!: () => void;
    const deferred = new Promise<void>(resolve => { release = resolve; });
    manager.updateAsset.mockImplementationOnce(async asset => {
      await deferred;
      manager.assets.set(asset.id, asset);
      return true;
    });
    const bridge = new MakeMdBridge(() => ({ manifest: { version: '1.3.5' }, superstate: { assets: manager } }), [icon]);
    const registering = bridge.register();
    const duplicateRegistration = bridge.register();
    let cleaned = false;
    const unloading = bridge.unregister().then(() => { cleaned = true; });
    await Promise.resolve();
    expect(bridge.isActive()).toBe(false);
    expect(cleaned).toBe(false);
    release();
    expect(await registering).toBe(false);
    expect(await duplicateRegistration).toBe(false);
    expect(manager.updateAsset).toHaveBeenCalledTimes(1);
    await unloading;
    expect(bridge.isActive()).toBe(false);
    expect(manager.getAsset('iconario-fa-solid')).toBeNull();
    expect(manager.iconsCache.has('iconario-fa-solid//house')).toBe(false);
    expect(manager.getAsset('foreign-pack')).toEqual({ id: 'foreign-pack' });
    expect(manager.getIconSync('other//icon')).toBe('foreign-svg');
    expect(await bridge.register()).toBe(true);
    await bridge.unregister();
    expect(bridge.isActive()).toBe(false);
    expect(manager.getIconsets()).toEqual([{ id: 'foreign-pack' }]);
    expect([...manager.iconsCache]).toEqual([['other//icon', 'foreign-svg']]);
  });
  it('encodes and decodes only namespaced Iconario stickers', () => {
    expect(encodeSticker(icon.id)).toBe('iconario-fa-solid//house');
    expect(decodeSticker('iconario-fa-solid//house')).toBe(icon.id);
    expect(decodeSticker('lucide//house')).toBeNull();
    expect(decodeSticker('iconario-fa-solid//bad/name')).toBeNull();
  });

  it('refuses absent or unsupported Make.md without mutation', async () => {
    const manager = fakeManager();
    const bridge = new MakeMdBridge(() => ({ manifest: { version: '1.3.4' }, superstate: { assets: manager } }), [icon]);
    expect(await bridge.register()).toBe(false);
    expect(manager.updateAsset).not.toHaveBeenCalled();
    expect(manager.iconsCache.size).toBe(0);
  });

  it('registers a selectable pack and cleans up only owned entries', async () => {
    const manager = fakeManager();
    manager.iconsCache.set('other//icon', 'other');
    const bridge = new MakeMdBridge(() => ({ manifest: { version: '1.3.5' }, superstate: { assets: manager } }), [icon]);
    expect(await bridge.register()).toBe(true);
    expect(manager.getIconsets()).toEqual([expect.objectContaining({ id: 'iconario-fa-solid', type: 'iconset' })]);
    expect(manager.getIconSync('iconario-fa-solid//house')).toBe(icon.svg);
    manager.iconsCache.set('iconario-fa-solid//house', 'changed elsewhere');
    await bridge.unregister();
    expect(manager.getIconSync('iconario-fa-solid//house')).toBe('changed elsewhere');
    expect(manager.getIconSync('other//icon')).toBe('other');
    expect(manager.getIconsets()).toEqual([]);
  });

  it('does not overwrite another asset at its namespace', async () => {
    const manager = fakeManager();
    manager.assets.set('iconario-fa-solid', { id: 'iconario-fa-solid', type: 'iconset', owner: 'other' });
    const bridge = new MakeMdBridge(() => ({ manifest: { version: '1.3.5' }, superstate: { assets: manager } }), [icon]);
    expect(await bridge.register()).toBe(false);
    expect(manager.updateAsset).not.toHaveBeenCalled();
  });

  it('restores old frontmatter only while the written value is still current', () => {
    expect(restoreOwnedValue('iconario-fa-solid//house', 'iconario-fa-solid//house', 'lucide//star')).toBe('lucide//star');
    expect(restoreOwnedValue('lucide//new', 'iconario-fa-solid//house', 'lucide//star')).toBe('lucide//new');
  });
});
