import Dexie, { type EntityTable } from 'dexie';
import { ENGLISH_CODE, type LanguageFile } from '../i18n/file';

/**
 * Translations kept on this device (decision 92): the files the user made or imported, in IndexedDB,
 * and the code of the one in use. English is supplied by the app and is never stored here: it
 * cannot be saved over, removed or chosen as a stored language.
 */

export interface LanguageSummary {
  code: string;
  name: string;
  author?: string | undefined;
  base: string;
  /** How many texts the file holds. */
  count: number;
}

export interface LanguageStore {
  list(): Promise<LanguageSummary[]>;
  load(code: string): Promise<LanguageFile | undefined>;
  /** Adds the language, or replaces the one with the same code. English is refused. */
  save(file: LanguageFile): Promise<void>;
  /** English cannot be removed: it is refused. */
  remove(code: string): Promise<void>;
  /** The code of the language in use, or null for English. */
  getActive(): Promise<string | null>;
  setActive(code: string | null): Promise<void>;
}

export class EnglishIsFixedError extends Error {
  constructor() {
    super('The English file is supplied by the app and cannot be changed or deleted.');
    this.name = 'EnglishIsFixedError';
  }
}

export function summaryOfLanguage(file: LanguageFile): LanguageSummary {
  return {
    code: file.language.code,
    name: file.language.name,
    ...(file.author ? { author: file.author } : {}),
    base: file.base,
    count: Object.keys(file.strings).length,
  };
}

const refuseEnglish = (code: string) => {
  if (code === ENGLISH_CODE) throw new EnglishIsFixedError();
};

export class MemoryLanguageStore implements LanguageStore {
  private files = new Map<string, LanguageFile>();
  private active: string | null = null;
  async list() {
    return [...this.files.values()].map(summaryOfLanguage);
  }
  async load(code: string) {
    return this.files.get(code);
  }
  async save(file: LanguageFile) {
    refuseEnglish(file.language.code);
    this.files.set(file.language.code, file);
  }
  async remove(code: string) {
    refuseEnglish(code);
    this.files.delete(code);
    if (this.active === code) this.active = null;
  }
  async getActive() {
    return this.active;
  }
  async setActive(code: string | null) {
    this.active = code === ENGLISH_CODE ? null : code;
  }
}

interface LanguageRow {
  code: string;
  updatedAt: number;
  file: LanguageFile;
}

class LanguageDb extends Dexie {
  languages!: EntityTable<LanguageRow, 'code'>;
  constructor(name: string) {
    super(name);
    this.version(1).stores({ languages: 'code, updatedAt' });
  }
}

const ACTIVE_KEY = 'soloquest-active-language';

export class DexieLanguageStore implements LanguageStore {
  private db: LanguageDb;
  constructor(name = 'soloquest-languages') {
    this.db = new LanguageDb(name);
  }
  async list() {
    try {
      return (await this.db.languages.toArray()).map((r) => summaryOfLanguage(r.file));
    } catch {
      return [];
    }
  }
  async load(code: string) {
    try {
      return (await this.db.languages.get(code))?.file;
    } catch {
      return undefined;
    }
  }
  async save(file: LanguageFile) {
    refuseEnglish(file.language.code);
    await this.db.languages.put({
      code: file.language.code,
      updatedAt: Date.now(),
      file,
    });
  }
  async remove(code: string) {
    refuseEnglish(code);
    await this.db.languages.delete(code);
    if ((await this.getActive()) === code) await this.setActive(null);
  }
  async getActive() {
    try {
      return localStorage.getItem(ACTIVE_KEY);
    } catch {
      return null;
    }
  }
  async setActive(code: string | null) {
    try {
      if (code && code !== ENGLISH_CODE) localStorage.setItem(ACTIVE_KEY, code);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch {
      /* storage unavailable: English is used the next time the app starts */
    }
  }
}
