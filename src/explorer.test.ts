// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NativeExplorerDecorator } from './explorer';

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M1 1h14v14H1z"/></svg>';

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('NativeExplorerDecorator', () => {
  it('decorates only assigned rows without replacing existing icons or controls', () => {
    document.body.innerHTML = `<div id="root">
      <div class="nav-folder-title" data-path="Folder"><span class="collapse-icon">arrow</span><span class="nav-folder-title-content">Folder</span></div>
      <div class="nav-file-title" data-path="Folder/A.md"><span class="other-plugin-icon">other</span><span class="nav-file-title-content">A</span></div>
      <div class="nav-file-title" data-path="B.md"><span class="nav-file-title-content">B</span></div>
    </div>`;
    const root = document.getElementById('root')!;
    const other = root.querySelector('.other-plugin-icon');
    const arrow = root.querySelector('.collapse-icon');
    const assignments = new Map([['Folder', 'fa-solid/folder'], ['Folder/A.md', 'fa-solid/house']]);
    const decorator = new NativeExplorerDecorator(root, path => assignments.get(path), () => svg);
    decorator.start();
    expect(root.querySelectorAll('.iconario-explorer-icon')).toHaveLength(2);
    expect(root.querySelector('[data-path="B.md"] .iconario-explorer-icon')).toBeNull();
    expect(root.querySelector('.other-plugin-icon')).toBe(other);
    expect(root.querySelector('.collapse-icon')).toBe(arrow);
    decorator.destroy();
    expect(root.querySelectorAll('.iconario-explorer-icon')).toHaveLength(0);
    expect(root.querySelector('.other-plugin-icon')).toBe(other);
    expect(root.querySelector('.collapse-icon')).toBe(arrow);
  });

  it('debounces added rows and stops observing after destroy', async () => {
    vi.useFakeTimers();
    const root = document.createElement('div');
    document.body.append(root);
    const decorator = new NativeExplorerDecorator(root, () => 'fa-solid/house', () => svg);
    decorator.start();
    root.innerHTML = '<div class="nav-file-title" data-path="A.md"><span class="nav-file-title-content">A</span></div>';
    await Promise.resolve();
    expect(root.querySelector('.iconario-explorer-icon')).toBeNull();
    await vi.advanceTimersByTimeAsync(40);
    expect(root.querySelectorAll('.iconario-explorer-icon')).toHaveLength(1);
    decorator.destroy();
    root.innerHTML = '<div class="nav-file-title" data-path="B.md"><span class="nav-file-title-content">B</span></div>';
    await vi.advanceTimersByTimeAsync(40);
    expect(root.querySelector('.iconario-explorer-icon')).toBeNull();
  });
});
