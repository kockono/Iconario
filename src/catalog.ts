import { icons } from './generated/icons';

export type IconCollection = 'fa-solid' | 'fa-regular' | 'fa-brands' | 'remix';

export interface IconRecord {
  readonly id: string;
  readonly name: string;
  readonly svg: string;
  readonly collection: IconCollection;
}

const records: readonly IconRecord[] = icons.map(([id, name, svg, collection]) => ({
  id,
  name,
  svg,
  collection: collection as IconCollection,
}));
export const allIcons: readonly IconRecord[] = records;
const byId = new Map(records.map((record) => [record.id, record]));

export function getIcon(id: string): IconRecord | undefined {
  return byId.get(id);
}

export function searchIcons(query: string, collection?: IconCollection, limit = 100): IconRecord[] {
  const maximum = Math.max(0, Math.min(100, Number.isFinite(limit) ? Math.floor(limit) : 0));
  if (maximum === 0) return [];
  const needle = query.trim().toLocaleLowerCase();
  const matches: IconRecord[] = [];
  for (const record of records) {
    if (collection && record.collection !== collection) continue;
    if (!record.name.includes(needle) && !record.id.includes(needle)) continue;
    matches.push(record);
    if (matches.length >= maximum) break;
  }
  return matches;
}
