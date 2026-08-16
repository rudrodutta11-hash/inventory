import Dexie, { type Table } from 'dexie';

export type Category =
  | 'single_malt' | 'blended_scotch' | 'bourbon' | 'rye'
  | 'irish' | 'japanese' | 'rum' | 'gin' | 'vodka'
  | 'tequila' | 'brandy' | 'liqueur' | 'other';

export const CATEGORIES: Category[] = [
  'single_malt', 'blended_scotch', 'bourbon', 'rye',
  'irish', 'japanese', 'rum', 'gin', 'vodka',
  'tequila', 'brandy', 'liqueur', 'other',
];

export const CATEGORY_LABELS: Record<Category, string> = {
  single_malt: 'Single malt',
  blended_scotch: 'Blended scotch',
  bourbon: 'Bourbon',
  rye: 'Rye',
  irish: 'Irish',
  japanese: 'Japanese',
  rum: 'Rum',
  gin: 'Gin',
  vodka: 'Vodka',
  tequila: 'Tequila',
  brandy: 'Brandy',
  liqueur: 'Liqueur',
  other: 'Other',
};

export interface Bottle {
  id?: number;
  serial: string;            // '017' — zero-padded, immutable, never reused
  name: string;              // 'Talisker 10'
  distillery?: string;
  category: Category;
  abv?: number;              // 43.0
  ageStatement?: number;     // years; undefined = NAS
  region?: string;
  sizeMl: number;            // 700 default
  caskType?: string;
  bottler?: 'official' | 'independent';
  caskStrength?: boolean;
  location?: string;         // 'Cabinet — top shelf'
  sealedCount: number;       // unopened backups, 0+
  isOpen: boolean;
  remainingMl: number;       // authoritative fill for the open bottle
  openedDate?: string;       // ISO
  purchaseDate?: string;
  purchasePrice?: number;
  purchasePlace?: string;
  rankIndex?: number;        // position within its category, 0 = best
  score?: number;            // derived from rank
  status: 'active' | 'finished' | 'wishlist';
  finishedDate?: string;
  notesQuick?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Pour {
  id?: number;
  bottleId: number;
  ml: number;                // positive = spirit removed; corrections may be negative
  at: string;
  note?: string;
  kind: 'pour' | 'correction';
}

export interface Note {
  id?: number;
  bottleId: number;
  at: string;
  text: string;
  peat?: number;   // 0–5
  sweet?: number;  // 0–5
  body?: number;   // 0–5
}

export interface Match {
  id?: number;
  a: number;
  b: number;
  result: 'a' | 'b' | 'tie' | 'skip';
  at: string;
}

export interface Photo {
  id?: number;
  bottleId: number;
  blob: Blob;
  kind: 'front' | 'back' | 'other';
  at: string;
}

export interface Meta {
  key: string;
  value: unknown;
}

export class CabinetDB extends Dexie {
  bottles!: Table<Bottle, number>;
  pours!: Table<Pour, number>;
  notes!: Table<Note, number>;
  matches!: Table<Match, number>;
  photos!: Table<Photo, number>;
  meta!: Table<Meta, string>;

  constructor(name = 'cabinet') {
    super(name);
    this.version(1).stores({
      bottles: '++id, serial, name, category, status, isOpen, rankIndex, [category+rankIndex], [status+isOpen]',
      pours:   '++id, bottleId, at',
      notes:   '++id, bottleId, at',
      matches: '++id, a, b, at',
      photos:  '++id, bottleId',
      meta:    'key',
    });
  }
}

export const db = new CabinetDB();
