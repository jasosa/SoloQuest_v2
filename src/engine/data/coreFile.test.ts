import { afterEach, describe, expect, it } from 'vitest';
import { CORE_ABILITIES, type AbilityDef } from './abilities';
import { applyCoreFile, CORE_EXTRA, CORE_RETIRED, parseCoreFile } from './coreFile';
import { CORE_SPELLS, type SpellDef } from './spells';

const abilities = [...CORE_ABILITIES];
const spells = [...CORE_SPELLS];
afterEach(() => {
  (CORE_ABILITIES as AbilityDef[]).splice(0, CORE_ABILITIES.length, ...abilities);
  (CORE_SPELLS as SpellDef[]).splice(0, CORE_SPELLS.length, ...spells);
  for (const k of Object.keys(CORE_RETIRED) as (keyof typeof CORE_RETIRED)[])
    CORE_RETIRED[k].clear();
  for (const k of Object.keys(CORE_EXTRA) as (keyof typeof CORE_EXTRA)[]) CORE_EXTRA[k].length = 0;
});

const file = (items: unknown[]) => parseCoreFile({ format: 'soloquest-core', items })!;

describe('Core files (decision 76)', () => {
  it('adds, changes and removes core abilities and spells', () => {
    applyCoreFile(
      file([
        {
          kind: 'ability',
          expansion: 'Frozen Horror',
          data: { id: 'icy', name: 'Icy', text: 'Cold.' },
        },
        { kind: 'ability', data: { id: 'stone', name: 'Stone', text: 'Two extra dice.' } },
        { kind: 'spell', data: { id: 'ice', name: 'Ice', tags: ['any'] } },
      ]),
    );
    expect(CORE_ABILITIES.find((a) => a.id === 'icy')?.text).toBe('Cold.');
    expect(CORE_ABILITIES.find((a) => a.id === 'stone')?.text).toBe('Two extra dice.');
    expect(CORE_SPELLS.find((s) => s.id === 'ice')?.core).toBe(true);
    applyCoreFile(file([{ kind: 'ability', deleted: true, data: { id: 'icy', name: 'Icy' } }]));
    expect(CORE_ABILITIES.some((a) => a.id === 'icy')).toBe(false);
    expect(CORE_RETIRED.ability.has('icy')).toBe(true);
  });

  it('adds core enemies, and hides a built-in monster type instead of removing it', () => {
    applyCoreFile(
      file([
        { kind: 'enemy', data: { id: 'ice-gremlin', name: 'Ice Gremlin', base: 'goblin' } },
        { kind: 'enemy', deleted: true, data: { id: 'zombie', name: 'Zombie' } },
      ]),
    );
    expect(CORE_EXTRA.enemy.map((e) => e.data.id)).toEqual(['ice-gremlin']);
    expect(CORE_RETIRED.enemy.has('zombie')).toBe(true);
  });

  it('refuses a file that is not a Core file', () => {
    expect(parseCoreFile({ format: 'other', items: [] })).toBeUndefined();
    expect(parseCoreFile(null)).toBeUndefined();
  });
});
