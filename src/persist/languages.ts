import Dexie, { type EntityTable } from 'dexie';
import { ENGLISH_CODE, type LanguageFile } from '../i18n/file';

/**
 * Translations kept on this device (decision 92): the files the user made or imported, in IndexedDB,
 * and the code of the one in use. English is supplied by the app and is built in. The texts the user
 * changed in English are kept here too, as a file with the code `en` that holds only those texts:
 * it can be saved (edited, reset, merged) but never removed, and it is not in `list()`.
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
  /** Adds the language, or replaces the one with the same code. Code `en`: the edited English. */
  save(file: LanguageFile): Promise<void>;
  /** Removes a language. English (`en`) can never be removed: it is refused. */
  remove(code: string): Promise<void>;
  /** Is there a file of edited English texts? Quick: read at every start. */
  englishEdited(): Promise<boolean>;
  /** The code of the language in use, or null for English. */
  getActive(): Promise<string | null>;
  setActive(code: string | null): Promise<void>;
}

export class EnglishCannotBeDeletedError extends Error {
  constructor() {
    super('The English file can be changed but never deleted.');
    this.name = 'EnglishCannotBeDeletedError';
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
  if (code === ENGLISH_CODE) throw new EnglishCannotBeDeletedError();
};
const hasTexts = (f: LanguageFile | undefined) => !!f && Object.keys(f.strings).length > 0;

export class MemoryLanguageStore implements LanguageStore {
  private files = new Map<string, LanguageFile>();
  private active: string | null = null;
  async list() {
    return [...this.files.values()]
      .filter((f) => f.language.code !== ENGLISH_CODE)
      .map(summaryOfLanguage);
  }
  async englishEdited() {
    return hasTexts(this.files.get(ENGLISH_CODE));
  }
  async load(code: string) {
    return this.files.get(code);
  }
  async save(file: LanguageFile) {
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
const EDITED_KEY = 'soloquest-english-edited';

export class DexieLanguageStore implements LanguageStore {
  private db: LanguageDb;
  constructor(name = 'soloquest-languages') {
    this.db = new LanguageDb(name);
  }
  async list() {
    try {
      return (await this.db.languages.toArray())
        .filter((r) => r.code !== ENGLISH_CODE)
        .map((r) => summaryOfLanguage(r.file));
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
    await this.db.languages.put({
      code: file.language.code,
      updatedAt: Date.now(),
      file,
    });
    if (file.language.code === ENGLISH_CODE) {
      try {
        if (hasTexts(file)) localStorage.setItem(EDITED_KEY, '1');
        else localStorage.removeItem(EDITED_KEY);
      } catch {
        /* the edited English is read from the database at the next start only if this flag is set */
      }
    }
  }
  async englishEdited() {
    try {
      return localStorage.getItem(EDITED_KEY) === '1';
    } catch {
      return false;
    }
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
