/** A path-to-icon map that can be serialized with Obsidian's plugin data API. */
export class AssignmentStore {
  private assignments = new Map<string, string>();

  constructor(initial: unknown = {}) {
    if (initial === null || typeof initial !== 'object' || Array.isArray(initial)) return;
    for (const [path, iconId] of Object.entries(initial)) {
      if (typeof iconId === 'string' && path.length > 0 && iconId.length > 0) {
        this.assignments.set(path, iconId);
      }
    }
  }

  get(path: string): string | undefined {
    return this.assignments.get(path);
  }

  set(path: string, iconId: string): void {
    if (!path || !iconId) throw new Error('Path and icon ID are required');
    this.assignments.set(path, iconId);
  }

  remove(path: string): void {
    this.assignments.delete(path);
  }

  /** Move one file or a folder and all descendants as a single atomic change. */
  rename(oldPath: string, newPath: string): void {
    if (!oldPath || !newPath) throw new Error('Paths are required');
    if (oldPath === newPath) return;

    const moved = [...this.assignments].filter(([path]) => isPathOrChild(path, oldPath));
    if (moved.length === 0) return;
    const movedPaths = new Set(moved.map(([path]) => path));
    const targets = moved.map(([path, iconId]) => [newPath + path.slice(oldPath.length), iconId] as const);
    if (targets.some(([path]) => this.assignments.has(path) && !movedPaths.has(path))) {
      throw new Error('Rename would overwrite an existing icon assignment');
    }
    for (const [path] of moved) this.assignments.delete(path);
    for (const [path, iconId] of targets) this.assignments.set(path, iconId);
  }

  /** Remove one file or a folder and all descendants. */
  delete(path: string): void {
    if (!path) return;
    for (const key of this.assignments.keys()) {
      if (isPathOrChild(key, path)) this.assignments.delete(key);
    }
  }

  toJSON(): Record<string, string> {
    return Object.fromEntries(this.assignments);
  }
}

function isPathOrChild(candidate: string, parent: string): boolean {
  return candidate === parent || candidate.startsWith(`${parent}/`);
}
