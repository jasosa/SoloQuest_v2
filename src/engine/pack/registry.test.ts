import { describe, expect, it } from 'vitest';
import { PackError, buildRegistry, parsePackManifest, type QuestRef } from './registry';
import type { PackManifest } from './schema';

const pack = (id: string, extra: Partial<PackManifest> = {}): PackManifest =>
  parsePackManifest({ schemaVersion: 1, id, name: id.toUpperCase(), ...extra });

const quests: QuestRef[] = [{ id: 'q1' }, { id: 'q2' }, { id: 'f0' }, { id: 'f1' }];

const problems = (fn: () => unknown): string[] => {
  try {
    fn();
  } catch (e) {
    if (e instanceof PackError) return e.issues;
    throw e;
  }
  return [];
};

describe('parsePackManifest', () => {
  it('fills the defaults and refuses what is not a manifest', () => {
    const m = parsePackManifest({ schemaVersion: 1, id: 'core', name: 'Core' });
    expect(m.dependsOn).toEqual([]);
    expect(m.quests).toEqual([]);
    expect(m.campaignSettings).toEqual([]);
    expect(() => parsePackManifest({ schemaVersion: 2, id: 'core', name: 'Core' })).toThrow(
      PackError,
    );
    expect(() => parsePackManifest({ schemaVersion: 1, id: 'Bad Id', name: 'x' })).toThrow(
      /dashes/,
    );
    expect(() => parsePackManifest({ schemaVersion: 1, id: 'a', name: 'x', surprise: 1 })).toThrow(
      PackError,
    );
  });
  it('a campaign setting is off unless it says otherwise', () => {
    const m = parsePackManifest({
      schemaVersion: 1,
      id: 'fh',
      name: 'FH',
      campaignSettings: [{ id: 'raiment', name: 'Raiment', text: 'Four artifacts are hidden.' }],
    });
    expect(m.campaignSettings[0]?.default).toBe(false);
  });
});

describe('buildRegistry', () => {
  const core = pack('core', { quests: ['q1', 'q2'] });
  const fh = pack('frozen-horror', { dependsOn: ['core'], quests: ['f0', 'f1'] });

  it('puts core first and says which pack each quest is in', () => {
    const r = buildRegistry([fh, core], quests);
    expect(r.packs.map((p) => p.manifest.id)).toEqual(['core', 'frozen-horror']);
    expect(r.byId.get('frozen-horror')?.requires).toEqual(['core']);
    expect(r.byId.get('core')?.requires).toEqual([]);
    expect(r.packOfQuest.get('q2')).toBe('core');
    expect(r.packOfQuest.get('f0')).toBe('frozen-horror');
  });

  it('a pack that needs another needs everything that one needs, dependencies first', () => {
    const a = pack('ice', { dependsOn: ['frozen-horror'] });
    const r = buildRegistry([core, fh, a], quests);
    expect(r.byId.get('ice')?.requires).toEqual(['core', 'frozen-horror']);
    expect(r.packs.map((p) => p.manifest.id)).toEqual(['core', 'frozen-horror', 'ice']);
  });

  it('wants a core pack that depends on nothing, and an expansion that depends on core', () => {
    expect(problems(() => buildRegistry([fh], quests.slice(2)))[0]).toMatch(/no "core" pack/);
    expect(
      problems(() => buildRegistry([pack('core', { dependsOn: ['frozen-horror'] }), fh], [])).join(
        ' ',
      ),
    ).toMatch(/depends on nothing/);
    const lonely = pack('lonely', { quests: ['f0'] });
    expect(
      problems(() => buildRegistry([core, lonely], [...quests.slice(0, 2), { id: 'f0' }])).join(
        ' ',
      ),
    ).toMatch(/expansion must depend on "core"/);
  });

  it('names a dependency that is not installed, and one on itself', () => {
    const p = pack('x', { dependsOn: ['core', 'missing'] });
    expect(problems(() => buildRegistry([core, p], quests.slice(0, 2))).join(' ')).toMatch(
      /depends on "missing", which is not installed/,
    );
    expect(
      problems(() =>
        buildRegistry([core, pack('y', { dependsOn: ['y', 'core'] })], quests.slice(0, 2)),
      ).join(' '),
    ).toMatch(/depends on itself/);
  });

  it('finds a circle of dependencies', () => {
    const a = pack('a', { dependsOn: ['core', 'b'] });
    const b = pack('b', { dependsOn: ['core', 'a'] });
    expect(problems(() => buildRegistry([core, a, b], quests.slice(0, 2))).join(' ')).toMatch(
      /in a circle: a > b > a/,
    );
  });

  it('refuses two manifests with one id', () => {
    expect(problems(() => buildRegistry([core, core], quests.slice(0, 2))).join(' ')).toMatch(
      /two manifests have this id/,
    );
  });

  it('checks the quests: they exist, each is in one pack, and nothing is left out', () => {
    const noQ = pack('core', { quests: ['q1', 'nope'] });
    expect(problems(() => buildRegistry([noQ], [{ id: 'q1' }])).join(' ')).toMatch(
      /lists quest "nope"/,
    );
    const twice = pack('frozen-horror', { dependsOn: ['core'], quests: ['q1'] });
    expect(problems(() => buildRegistry([core, twice], quests)).join(' ')).toMatch(
      /listed by both core and frozen-horror/,
    );
    expect(
      problems(() => buildRegistry([core], [...quests.slice(0, 2), { id: 'orphan' }])).join(' '),
    ).toMatch(/quest "orphan": no pack lists it/);
  });

  it('a quest file that names its pack must agree with the pack that lists it', () => {
    const wrong: QuestRef[] = [{ id: 'q1', pack: 'frozen-horror' }, { id: 'q2' }];
    expect(problems(() => buildRegistry([core, fh], wrong)).join(' ')).toMatch(
      /the file says pack "frozen-horror" but pack core lists it/,
    );
    const ok: QuestRef[] = [
      { id: 'q1', pack: 'core' },
      { id: 'q2' },
      { id: 'f0', pack: 'frozen-horror' },
      { id: 'f1' },
    ];
    expect(() => buildRegistry([core, fh], ok)).not.toThrow();
    const ghost: QuestRef[] = [{ id: 'q1' }, { id: 'q2' }, { id: 'z', pack: 'gone' }];
    expect(problems(() => buildRegistry([core], ghost)).join(' ')).toMatch(
      /belongs to pack "gone", which is not installed/,
    );
  });

  it('reports every problem at once', () => {
    const bad = pack('bad', { dependsOn: ['missing'], quests: ['nope'] });
    expect(
      problems(() => buildRegistry([core, bad], quests.slice(0, 2))).length,
    ).toBeGreaterThanOrEqual(3);
  });
});
