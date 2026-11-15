import { describe, expect, it } from 'vitest';
import { parseLines, parseOverrides, toggleIn } from './inspectorForms';

const blank = { move: '', att: '', def: '', body: '', mind: '' };

describe('inspector forms', () => {
  it('empty stat fields give no override', () => {
    expect(parseOverrides(blank)).toEqual({ ok: true, overrides: {} });
    expect(parseOverrides({ ...blank, att: '5', mind: ' 0 ' })).toEqual({
      ok: true,
      overrides: { att: 5, mind: 0 },
    });
  });
  it('refuses text that is not a whole number', () => {
    for (const bad of ['-1', '2.5', 'x', '1e2']) {
      expect(parseOverrides({ ...blank, body: bad }).ok).toBe(false);
    }
  });
  it('splits lines and drops empty ones', () => {
    expect(parseLines(' a \n\n b\n')).toEqual(['a', 'b']);
  });
  it('toggles in list order', () => {
    const order = ['a', 'b', 'c'] as const;
    expect(toggleIn(['c'], 'a', order)).toEqual(['a', 'c']);
    expect(toggleIn(['a', 'c'], 'c', order)).toEqual(['a']);
  });
});
