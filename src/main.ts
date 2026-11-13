import { editorLivePreviewField, App, Modal, Notice, Plugin, PluginSettingTab, Setting, TAbstractFile, TFile, TFolder } from 'obsidian';
import { allIcons, getIcon } from './catalog';
import { AssignmentStore } from './assignments';
import { NativeExplorerDecorator } from './explorer';
import { createIconLivePreviewExtension, renderMarkdownTokens, tokenFor } from './markdown';
import { MakeMdBridge, encodeSticker, restoreOwnedValue } from './makemd';
import { IconPicker, validateAppearance, type Appearance } from './picker';

interface OwnedSticker { previous: unknown; written: string; notePath: string; property: string; order?: number }
interface PluginData {
  assignments: Record<string, string>;
  favorites: string[];
  recents: string[];
  nativeExplorer: boolean;
  makeSync: boolean;
  stickerProperty: string;
  color: string;
  size: number;
  ownedStickers: Record<string, OwnedSticker>;
}

const DEFAULTS: PluginData = {
  assignments: {}, favorites: [], recents: [], nativeExplorer: true, makeSync: true,
  stickerProperty: 'sticker', color: 'currentColor', size: 20, ownedStickers: {},
};

class PickerModal extends Modal {
  constructor(app: App, private readonly plugin: IconarioPlugin,
              private readonly onPick: (id: string, appearance: Appearance) => void) { super(app); }
  onOpen(): void {
    this.titleEl.setText('Elegir icono');
    new IconPicker(this.contentEl, allIcons, {
      favorites: this.plugin.data.favorites, recents: this.plugin.data.recents,
      appearance: { color: this.plugin.data.color, size: this.plugin.data.size },
      onSelect: (id, appearance) => { this.close(); this.onPick(id, appearance); },
      onFavoritesChange: favorites => { this.plugin.data.favorites = favorites; void this.plugin.persist(); },
    }).mount();
  }
  onClose(): void { this.contentEl.empty(); }
}

class ConfirmFolderNoteModal extends Modal {
  private answered = false;
  constructor(app: App, private readonly path: string, private readonly resolve: (yes: boolean) => void) { super(app); }
  onOpen(): void {
    this.titleEl.setText('Crear nota de carpeta');
    this.contentEl.createEl('p', { text: `Make.md necesita la nota ${this.path}. ¿Crear esta nota?` });
    new Setting(this.contentEl).addButton(button => button.setButtonText('Crear').onClick(() => { this.answered = true; this.resolve(true); this.close(); }))
      .addButton(button => button.setButtonText('Cancelar').onClick(() => { this.answered = true; this.resolve(false); this.close(); }));
  }
  onClose(): void { if (!this.answered) this.resolve(false); this.contentEl.empty(); }
}

export default class IconarioPlugin extends Plugin {
  data: PluginData = { ...DEFAULTS };
  private assignments = new AssignmentStore();
  private makeBridge?: MakeMdBridge;
  private decorators: NativeExplorerDecorator[] = [];
  private saveChain: Promise<void> = Promise.resolve();

  async onload(): Promise<void> {
    const loaded = await this.loadData() as Partial<PluginData> | null;
    this.data = { ...DEFAULTS, ...(loaded ?? {}) };
    this.data.favorites = Array.isArray(this.data.favorites) ? this.data.favorites.filter(id => !!getIcon(id)) : [];
    this.data.recents = Array.isArray(this.data.recents) ? this.data.recents.filter(id => !!getIcon(id)).slice(0, 20) : [];
    this.data.ownedStickers = this.data.ownedStickers && typeof this.data.ownedStickers === 'object' ? this.data.ownedStickers : {};
    this.assignments = new AssignmentStore(this.data.assignments);
    this.applyAppearance();
    this.addCommand({ id: 'insert-icon', name: 'Insertar icono en la nota activa', editorCallback: editor => {
      new PickerModal(this.app, this, (id, appearance) => {
        editor.replaceSelection(tokenFor(id));
        this.recordRecent(id, appearance);
      }).open();
    } });
    this.addCommand({ id: 'assign-icon', name: 'Asignar icono al archivo activo', callback: () => {
      const file = this.app.workspace.getActiveFile();
      if (file) this.openAssignmentPicker(file);
      else new Notice('No hay un archivo activo');
    } });
    this.addCommand({ id: 'remove-icon', name: 'Quitar icono del archivo activo', callback: () => {
      const file = this.app.workspace.getActiveFile();
      if (file) void this.removeAssignment(file);
      else new Notice('No hay un archivo activo');
    } });
    this.registerMarkdownPostProcessor(element => renderMarkdownTokens(element, id => getIcon(id)?.svg));
    this.registerEditorExtension(createIconLivePreviewExtension(id => getIcon(id)?.svg, state => state.field(editorLivePreviewField, false) === true));
    this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
      menu.addItem(item => item.setTitle('Asignar icono con Iconario').onClick(() => this.openAssignmentPicker(file)));
      if (this.assignments.get(file.path)) menu.addItem(item => item.setTitle('Quitar icono de Iconario').onClick(() => void this.removeAssignment(file)));
    }));
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      try {
        this.assignments.rename(oldPath, file.path);
        for (const [path, owned] of Object.entries(this.data.ownedStickers)) {
          if (path === oldPath || path.startsWith(`${oldPath}/`)) {
            delete this.data.ownedStickers[path];
            const next = file.path + path.slice(oldPath.length);
            this.data.ownedStickers[next] = { ...owned, notePath: owned.notePath === oldPath || owned.notePath.startsWith(`${oldPath}/`) ? file.path + owned.notePath.slice(oldPath.length) : owned.notePath };
          } else if (owned.notePath === oldPath || owned.notePath.startsWith(`${oldPath}/`)) {
            owned.notePath = file.path + owned.notePath.slice(oldPath.length);
          }
        }
        void this.persist(); this.refreshDecorators();
      }
      catch (error) { new Notice(`Iconario: no se pudo actualizar la asignación: ${String(error)}`); }
    }));
    this.registerEvent(this.app.vault.on('delete', file => {
      this.assignments.delete(file.path);
      for (const path of Object.keys(this.data.ownedStickers)) if (path === file.path || path.startsWith(`${file.path}/`)) delete this.data.ownedStickers[path];
      void this.persist(); this.refreshDecorators();
    }));
    this.addSettingTab(new IconarioSettings(this.app, this));
    this.app.workspace.onLayoutReady(() => {
      this.refreshDecorators();
      void this.registerMakeMd();
    });
    this.registerEvent(this.app.workspace.on('layout-change', () => { this.refreshDecorators(); void this.registerMakeMd(); }));
  }

  async onunload(): Promise<void> {
    this.clearDecorators();
    await this.makeBridge?.unregister();
    document.body.style.removeProperty('--iconario-color');
    document.body.style.removeProperty('--iconario-size');
  }

  async persist(): Promise<void> {
    this.data.assignments = this.assignments.toJSON();
    this.saveChain = this.saveChain.catch(() => undefined).then(() => this.saveData(this.data));
    await this.saveChain;
  }

  private recordRecent(id: string, appearance: Appearance): void {
    this.data.recents = [id, ...this.data.recents.filter(other => other !== id)].slice(0, 20);
    const valid = validateAppearance(appearance.color, appearance.size);
    this.data.color = valid.color; this.data.size = valid.size;
    this.applyAppearance();
    void this.persist();
  }

  private applyAppearance(): void {
    const valid = validateAppearance(this.data.color, this.data.size);
    document.body.style.setProperty('--iconario-color', valid.color);
    document.body.style.setProperty('--iconario-size', `${valid.size}px`);
  }

  private openAssignmentPicker(file: TAbstractFile): void {
    new PickerModal(this.app, this, (id, appearance) => { void this.assign(file, id); this.recordRecent(id, appearance); }).open();
  }

  private async assign(file: TAbstractFile, id: string): Promise<void> {
    if (!getIcon(id)) return;
    if (this.data.makeSync && this.makeBridge?.isActive()) {
      const synced = await this.writeMakeSticker(file, id);
      if (!synced) new Notice('Iconario: icono local asignado; Make.md no se sincronizó');
    }
    this.assignments.set(file.path, id);
    await this.persist(); this.refreshDecorators();
  }

  private async removeAssignment(file: TAbstractFile): Promise<void> {
    await this.restoreMakeSticker(file.path);
    this.assignments.remove(file.path);
    await this.persist(); this.refreshDecorators();
  }

  private makePlugin(): unknown {
    return (this.app as App & { plugins?: { getPlugin(id: string): unknown } }).plugins?.getPlugin('make-md');
  }

  private async registerMakeMd(): Promise<void> {
    if (this.makeBridge?.isActive()) return;
    this.makeBridge = new MakeMdBridge(() => this.makePlugin() as ReturnType<ConstructorParameters<typeof MakeMdBridge>[0]>, allIcons);
    if (!await this.makeBridge.register() && this.makePlugin()) new Notice('Iconario: Make.md no ofrece la integración compatible con 1.3.5');
  }

  private folderNotePath(folder: TFolder): string | null {
    const make = this.makePlugin() as { superstate?: { settings?: { folderNoteName?: string } } } | null;
    const configured = make?.superstate?.settings?.folderNoteName;
    const basename = configured && /^[^\\/:*?"<>|]+$/.test(configured) ? configured : folder.name;
    return folder.path ? `${folder.path}/${basename}.md` : null;
  }

  private async targetNote(file: TAbstractFile): Promise<TFile | null> {
    if (file instanceof TFile) return file.extension === 'md' ? file : null;
    if (!(file instanceof TFolder)) return null;
    const path = this.folderNotePath(file);
    if (!path) return null;
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) return existing;
    if (existing) return null;
    const confirmed = await new Promise<boolean>(resolve => new ConfirmFolderNoteModal(this.app, path, resolve).open());
    if (!confirmed) return null;
    return await this.app.vault.create(path, '');
  }

  private async writeMakeSticker(file: TAbstractFile, id: string): Promise<boolean> {
    const sticker = encodeSticker(id);
    if (!sticker || !/^[A-Za-z][\w-]*$/.test(this.data.stickerProperty)) return false;
    const note = await this.targetNote(file);
    if (!note) return false;
    const property = this.data.stickerProperty;
    await this.app.fileManager.processFrontMatter(note, frontmatter => {
      const owners = Object.values(this.data.ownedStickers)
        .filter(owner => owner.notePath === note.path && owner.property === property)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const latest = owners.at(-1);
      const current = frontmatter[property];
      const previous = latest && current === latest.written ? latest.previous : current;
      // All assignments addressing the same physical value share its baseline.
      for (const owner of owners) owner.previous = previous;
      const order = Math.max(0, ...owners.map(owner => owner.order ?? 0)) + 1;
      frontmatter[property] = sticker;
      this.data.ownedStickers[file.path] = { previous, written: sticker, notePath: note.path, property, order };
    });
    await this.persist();
    return true;
  }

  private async restoreMakeSticker(path: string): Promise<void> {
    const owner = this.data.ownedStickers[path];
    if (!owner) return;
    const note = this.app.vault.getAbstractFileByPath(owner.notePath);
    if (note instanceof TFile) {
      const property = owner.property;
      await this.app.fileManager.processFrontMatter(note, frontmatter => {
        // Read and remove ownership in the same synchronous mutation as frontmatter.
        const owners = Object.entries(this.data.ownedStickers)
          .filter(([, other]) => other.notePath === note.path && other.property === property)
          .sort(([, a], [, b]) => (a.order ?? 0) - (b.order ?? 0));
        const latest = owners.at(-1);
        const remaining = owners.filter(([key]) => key !== path).at(-1)?.[1];
        if (latest?.[0] === path) {
          const restored = restoreOwnedValue(frontmatter[property], owner.written, remaining?.written ?? owner.previous);
          if (restored === undefined) delete frontmatter[property];
          else frontmatter[property] = restored;
        }
        delete this.data.ownedStickers[path];
      });
    } else delete this.data.ownedStickers[path];
  }

  refreshDecorators(): void {
    this.clearDecorators();
    if (!this.data.nativeExplorer) return;
    for (const root of document.querySelectorAll<HTMLElement>('.workspace-leaf-content[data-type="file-explorer"]')) {
      const decorator = new NativeExplorerDecorator(root, path => this.assignments.get(path), id => getIcon(id)?.svg);
      decorator.start(); this.decorators.push(decorator);
    }
  }

  private clearDecorators(): void { for (const decorator of this.decorators) decorator.destroy(); this.decorators = []; }
}

class IconarioSettings extends PluginSettingTab {
  constructor(app: App, private readonly plugin: IconarioPlugin) { super(app, plugin); }
  display(): void {
    this.containerEl.empty();
    this.containerEl.createEl('h2', { text: 'Iconario' });
    new Setting(this.containerEl).setName('Explorador nativo').setDesc('Mostrar los iconos asignados en el explorador de archivos')
      .addToggle(toggle => toggle.setValue(this.plugin.data.nativeExplorer).onChange(async value => {
        this.plugin.data.nativeExplorer = value; await this.plugin.persist(); this.plugin.refreshDecorators();
      }));
    new Setting(this.containerEl).setName('Sincronizar con Make.md').setDesc('Escribir el sticker en el frontmatter de notas Markdown')
      .addToggle(toggle => toggle.setValue(this.plugin.data.makeSync).onChange(async value => { this.plugin.data.makeSync = value; await this.plugin.persist(); }));
    new Setting(this.containerEl).setName('Propiedad de sticker').setDesc('Nombre de la propiedad de frontmatter usada por Make.md')
      .addText(text => text.setValue(this.plugin.data.stickerProperty).onChange(async value => {
        if (!/^[A-Za-z][\w-]*$/.test(value)) return;
        if (Object.keys(this.plugin.data.ownedStickers).length > 0) {
          new Notice('Quita primero los stickers asignados por Iconario antes de cambiar esta propiedad');
          text.setValue(this.plugin.data.stickerProperty);
          return;
        }
        this.plugin.data.stickerProperty = value; await this.plugin.persist();
      }));
  }
}
