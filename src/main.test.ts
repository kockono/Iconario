// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
vi.mock('obsidian', async () => {
  const { StateField } = await import('@codemirror/state');
  class Plugin {
    constructor(public app: unknown) {}
    async loadData() { return null; }
    async saveData() {}
    addCommand() {}
    registerMarkdownPostProcessor() {}
    registerEditorExtension() {}
    registerEvent() {}
    addSettingTab() {}
  }
  return { Plugin, App: class {}, Modal: class {}, Notice: class {}, PluginSettingTab: class {}, Setting: class {},
    TAbstractFile: class {}, TFile: class {}, TFolder: class {}, editorLivePreviewField: StateField.define({ create: () => false, update: value => value }) };
});

import { App, TFile, TFolder } from 'obsidian';
import IconarioPlugin from './main';
import { MakeMdBridge } from './makemd';

function harness() {
  const folder = Object.assign(Object.create(TFolder.prototype), { path: 'Folder', name: 'Folder' }) as TFolder;
  const note = Object.assign(Object.create(TFile.prototype), { path: 'Folder/Folder.md', extension: 'md' }) as TFile;
  const other = Object.assign(Object.create(TFile.prototype), { path: 'Else/Other.md', extension: 'md' }) as TFile;
  const files = new Map<string, TFile | TFolder>([[folder.path, folder], [note.path, note], [other.path, other]]);
  const fm = new Map<string, Record<string, unknown>>([[note.path, { sticker: 'original', title: 'Conservar', nested: { a: 1 } }], [other.path, { sticker: 'other-original' }]]);
  let rename: (file: TFile | TFolder, oldPath: string) => void = () => {};
  const app = {
    workspace: { on: () => ({}), onLayoutReady: () => {} },
    vault: { getAbstractFileByPath: (path: string) => files.get(path), on: (event: string, callback: typeof rename) => { if (event === 'rename') rename = callback; return {}; } },
    fileManager: { processFrontMatter: async (file: TFile, callback: (value: Record<string, unknown>) => void) => callback(fm.get(file.path)!) },
  };
  const plugin = new IconarioPlugin(app as unknown as App, { id: 'iconario', name: 'Iconario', author: '', version: '0.1.0', minAppVersion: '1.0.0', description: '' });
  plugin.data = { ...plugin.data, ownedStickers: {} };
  const move = (file: TFile | TFolder, newPath: string) => {
    const oldPath = file.path;
    for (const [path, entry] of [...files]) {
      if (path === oldPath || path.startsWith(oldPath + '/')) {
        const next = newPath + path.slice(oldPath.length);
        files.delete(path); entry.path = next; files.set(next, entry);
        if (fm.has(path)) { fm.set(next, fm.get(path)!); fm.delete(path); }
      }
    }
    file.path = newPath;
    rename(file, oldPath);
  };
  return { plugin, folder, note, other, fm, move, app };
}

function deferNextFrontmatter(app: ReturnType<typeof harness>['app']) {
  const process = app.fileManager.processFrontMatter;
  let release!: () => void;
  let entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { entered = resolve; });
  vi.spyOn(app.fileManager, 'processFrontMatter').mockImplementationOnce(async (file, callback) => {
    entered();
    await gate;
    await process(file, callback);
  });
  return { started, release: () => release() };
}

function enableMake(plugin: IconarioPlugin) {
  const bridge = new MakeMdBridge(() => null, []);
  vi.spyOn(bridge, 'isActive').mockReturnValue(true);
  plugin['makeBridge'] = bridge;
}

describe('pending restoration lifecycle', () => {
  it.each(['removal-first', 'assignment-first'])('keeps the newest intent across rename with %s callbacks', async order => {
    const { plugin, note, fm, app, move } = harness();
    await plugin.onload();
    enableMake(plugin);
    await plugin['assign'](note, 'fa-solid/house');
    const removal = deferNextFrontmatter(app);
    const removing = plugin['removeAssignment'](note);
    await removal.started;
    move(note, 'New.md');
    fm.get(note.path)!.sticker = 'external';
    const assignment = deferNextFrontmatter(app);
    const assigning = plugin['assign'](note, 'fa-solid/house');
    await assignment.started;
    // Both operations have reached the API; release each explicitly, not via timeouts.
    if (order === 'removal-first') {
      removal.release(); await removing;
      assignment.release(); await assigning;
    } else {
      assignment.release(); await assigning;
      removal.release(); await removing;
    }
    expect(plugin.data.assignments).toEqual({ 'New.md': 'fa-solid/house' });
    expect(plugin.data.ownedStickers).toEqual({ 'New.md': expect.objectContaining({ previous: 'external', written: house, notePath: 'New.md' }) });
    expect(fm.get(note.path)?.sticker).toBe(house);
    await plugin['removeAssignment'](note);
    expect(fm.get(note.path)).toEqual({ sticker: 'external', title: 'Conservar', nested: { a: 1 } });
    expect(plugin.data.assignments).toEqual({});
    expect(plugin.data.ownedStickers).toEqual({});
  });

  it.each(['fa-solid/star', 'fa-solid/house'])('keeps a newer %s assignment when an old removal completes last', async id => {
    const { plugin, note, fm, app } = harness();
    enableMake(plugin);
    await plugin['assign'](note, 'fa-solid/house');
    const deferred = deferNextFrontmatter(app);
    const removing = plugin['removeAssignment'](note);
    await deferred.started;
    fm.get(note.path)!.sticker = 'external';
    await plugin['assign'](note, id);
    deferred.release();
    await removing;
    const written = id === 'fa-solid/house' ? house : star;
    expect(plugin.data.assignments).toEqual({ [note.path]: id });
    expect(fm.get(note.path)?.sticker).toBe(written);
    expect(plugin.data.ownedStickers[note.path]).toMatchObject({ previous: 'external', written });
    await plugin['removeAssignment'](note);
    expect(fm.get(note.path)?.sticker).toBe('external');
    expect(plugin.data.assignments).toEqual({});
    expect(plugin.data.ownedStickers).toEqual({});
  });

  it('does not let an old restoration discard reassignment ownership or its external baseline', async () => {
    const { plugin, note, fm, app } = harness();
    enableMake(plugin);
    await plugin['assign'](note, 'fa-solid/house');
    const deferred = deferNextFrontmatter(app);
    const restoring = plugin['restoreMakeSticker'](note.path);
    await deferred.started;
    fm.get(note.path)!.sticker = 'external';
    await plugin['assign'](note, 'fa-solid/star');
    deferred.release();
    await restoring;
    expect(plugin.data.assignments).toEqual({ [note.path]: 'fa-solid/star' });
    expect(fm.get(note.path)?.sticker).toBe(star);
    expect(plugin.data.ownedStickers[note.path]).toMatchObject({ previous: 'external', written: star });
    await plugin['removeAssignment'](note);
    expect(fm.get(note.path)).toEqual({ sticker: 'external', title: 'Conservar', nested: { a: 1 } });
    expect(plugin.data.assignments).toEqual({});
    expect(plugin.data.ownedStickers).toEqual({});
  });

  it('finishes removal at the current path when the real rename event runs before restoration', async () => {
    const { plugin, note, fm, move, app } = harness();
    await plugin.onload();
    enableMake(plugin);
    await plugin['assign'](note, 'fa-solid/house');
    const deferred = deferNextFrontmatter(app);
    const removing = plugin['removeAssignment'](note);
    await deferred.started;
    move(note, 'New.md');
    deferred.release();
    await removing;
    expect(plugin.data.assignments).toEqual({});
    expect(fm.get(note.path)).toEqual({ sticker: 'original', title: 'Conservar', nested: { a: 1 } });
    expect(plugin.data.ownedStickers).toEqual({});
  });
});

describe('physical note rename references', () => {
  it('keeps assignment ownership at the current path when renamed before a deferred write callback', async () => {
    const { plugin, note, fm, move, app } = harness();
    await plugin.onload();
    move(note, 'Old.md');
    const bridge = new MakeMdBridge(() => null, []);
    vi.spyOn(bridge, 'isActive').mockReturnValue(true);
    plugin['makeBridge'] = bridge;
    const process = app.fileManager.processFrontMatter;
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { entered = resolve; });
    vi.spyOn(app.fileManager, 'processFrontMatter').mockImplementationOnce(async (file, callback) => {
      entered();
      await gate;
      await process(file, callback);
    });
    const assigning = plugin['assign'](note, 'fa-solid/house');
    await started;
    move(note, 'New.md');
    release();
    await assigning;
    expect(plugin.data.assignments).toEqual({ 'New.md': 'fa-solid/house' });
    expect(fm.get('New.md')?.sticker).toBe(house);
    await plugin['restoreMakeSticker']('New.md');
    expect(fm.get('New.md')).toEqual({ sticker: 'original', title: 'Conservar', nested: { a: 1 } });
    expect(plugin.data.ownedStickers).toEqual({});
  });

  it('restores a folder assignment after only its note is renamed', async () => {
    const { plugin, folder, note, other, fm, move } = harness();
    await plugin.onload();
    await plugin['writeMakeSticker'](folder, 'fa-solid/house');
    await plugin['writeMakeSticker'](other, 'fa-solid/star');
    const unrelated = { ...plugin.data.ownedStickers[other.path] };
    move(note, 'Folder/Renamed.md');
    expect(plugin.data.ownedStickers[folder.path]?.notePath).toBe(note.path);
    expect(plugin.data.ownedStickers[other.path]).toEqual(unrelated);
    await plugin['restoreMakeSticker'](folder.path);
    expect(fm.get(note.path)?.sticker).toBe('original');
    expect(fm.get(other.path)?.sticker).toBe(star);
  });

  it.each(['Folder', ''])('updates folder and subtree references when renaming %s', async root => {
    const { plugin, folder, note, other, fm, move } = harness();
    await plugin.onload();
    await plugin['writeMakeSticker'](folder, 'fa-solid/house');
    await plugin['writeMakeSticker'](note, 'fa-solid/star');
    await plugin['writeMakeSticker'](other, 'fa-solid/heart');
    const unrelated = { ...plugin.data.ownedStickers[other.path] };
    if (root) move(folder, 'Renamed');
    else {
      // A parent-folder event updates all descendant physical notes and keys.
      const parent = Object.assign(Object.create(TFolder.prototype), { path: 'Parent', name: 'Parent' }) as TFolder;
      move(folder, 'Parent/Folder');
      // The harness tracks physical descendant moves through the same boundary.
      move(parent, 'Moved');
    }
    expect(plugin.data.ownedStickers[folder.path]?.notePath).toBe(note.path);
    expect(plugin.data.ownedStickers[note.path]?.notePath).toBe(note.path);
    expect(plugin.data.ownedStickers[other.path]).toEqual(unrelated);
    await plugin['restoreMakeSticker'](folder.path);
    await plugin['restoreMakeSticker'](note.path);
    expect(fm.get(note.path)?.sticker).toBe('original');
  });
});

const house = 'iconario-fa-solid//house';
const star = 'iconario-fa-solid//star';

describe('shared physical frontmatter ownership', () => {
  it('restores the original metadata when shared-owner removals overlap a deferred callback', async () => {
    const { plugin, folder, note, fm, app } = harness();
    await plugin['writeMakeSticker'](folder, 'fa-solid/house');
    await plugin['writeMakeSticker'](note, 'fa-solid/star');
    const process = app.fileManager.processFrontMatter;
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { entered = resolve; });
    vi.spyOn(app.fileManager, 'processFrontMatter').mockImplementationOnce(async (file, callback) => {
      entered();
      await gate;
      await process(file, callback);
    });
    const removingNote = plugin['restoreMakeSticker'](note.path);
    await started;
    await plugin['restoreMakeSticker'](folder.path);
    release();
    await removingNote;
    expect(fm.get(note.path)).toEqual({ sticker: 'original', title: 'Conservar', nested: { a: 1 } });
    expect(plugin.data.ownedStickers).toEqual({});
  });

  it.each([['Folder', 'Folder/Folder.md'], ['Folder/Folder.md', 'Folder']])('keeps the original baseline through reassignments and removes in order %s, %s', async (first, second) => {
    const { plugin, folder, note, fm } = harness();
    await plugin['writeMakeSticker'](folder, 'fa-solid/house');
    await plugin['writeMakeSticker'](note, 'fa-solid/star');
    await plugin['writeMakeSticker'](folder, 'fa-solid/heart');
    await plugin['writeMakeSticker'](note, 'fa-solid/house');
    await plugin['restoreMakeSticker'](first);
    await plugin['restoreMakeSticker'](second);
    expect(fm.get(note.path)?.sticker).toBe('original');
    expect(plugin.data.ownedStickers).toEqual({});
  });

  it.each([false, true])('preserves external edits, including a new baseline on reassignment (%s)', async reassign => {
    const { plugin, folder, note, fm } = harness();
    await plugin['writeMakeSticker'](folder, 'fa-solid/house');
    await plugin['writeMakeSticker'](note, 'fa-solid/star');
    fm.get(note.path)!.sticker = 'external';
    if (reassign) await plugin['writeMakeSticker'](folder, 'fa-solid/heart');
    await plugin['restoreMakeSticker'](folder.path);
    await plugin['restoreMakeSticker'](note.path);
    expect(fm.get(note.path)?.sticker).toBe('external');
    expect(plugin.data.ownedStickers).toEqual({});
  });

  it('removes an originally absent property without touching other properties', async () => {
    const { plugin, folder, note, fm } = harness();
    delete fm.get(note.path)!.sticker;
    await plugin['writeMakeSticker'](folder, 'fa-solid/house');
    await plugin['writeMakeSticker'](note, 'fa-solid/star');
    await plugin['restoreMakeSticker'](folder.path);
    await plugin['restoreMakeSticker'](note.path);
    expect(fm.get(note.path)).toEqual({ title: 'Conservar', nested: { a: 1 } });
  });
  it.each([['Folder', 'Folder/Folder.md'], ['Folder/Folder.md', 'Folder']])('restores the shared baseline when removing %s then %s', async (first, second) => {
    const { plugin, folder, note, fm } = harness();
    await plugin['writeMakeSticker'](folder, 'fa-solid/house');
    await plugin['writeMakeSticker'](note, 'fa-solid/star');
    expect(fm.get(note.path)?.sticker).toBe(star);
    await plugin['restoreMakeSticker'](first);
    expect(fm.get(note.path)?.sticker).toBe(first === folder.path ? star : house);
    await plugin['restoreMakeSticker'](second);
    expect(fm.get(note.path)).toEqual({ sticker: 'original', title: 'Conservar', nested: { a: 1 } });
    expect(plugin.data.ownedStickers).toEqual({});
  });
});
