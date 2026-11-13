import { describe, expect, it } from 'vitest';
import { AssignmentStore } from './assignments';

describe('AssignmentStore', () => {
  it('persists assignments without losing unrelated paths', () => {
    const store = new AssignmentStore({ 'A.md': 'fa-solid/house' });
    store.set('Folder/B.md', 'ri/home-line');
    store.remove('A.md');
    expect(store.toJSON()).toEqual({ 'Folder/B.md': 'ri/home-line' });
    expect(new AssignmentStore(store.toJSON()).get('Folder/B.md')).toBe('ri/home-line');
  });

  it('moves a folder prefix and leaves similarly named paths alone', () => {
    const store = new AssignmentStore({
      Folder: 'fa-solid/folder',
      'Folder/A.md': 'fa-solid/house',
      'Folder/Sub/B.md': 'ri/home-line',
      'Folderish/C.md': 'ri/home-fill',
    });
    store.rename('Folder', 'Moved');
    expect(store.toJSON()).toEqual({
      Moved: 'fa-solid/folder',
      'Moved/A.md': 'fa-solid/house',
      'Moved/Sub/B.md': 'ri/home-line',
      'Folderish/C.md': 'ri/home-fill',
    });
    store.delete('Moved/Sub');
    expect(store.toJSON()).toEqual({
      Moved: 'fa-solid/folder',
      'Moved/A.md': 'fa-solid/house',
      'Folderish/C.md': 'ri/home-fill',
    });
  });

  it('rejects a rename collision without changing either assignment', () => {
    const store = new AssignmentStore({ 'Old/A.md': 'fa-solid/house', 'New/A.md': 'ri/home-line' });
    expect(() => store.rename('Old', 'New')).toThrow();
    expect(store.toJSON()).toEqual({ 'Old/A.md': 'fa-solid/house', 'New/A.md': 'ri/home-line' });
  });
});
