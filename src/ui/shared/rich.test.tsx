import { describe, expect, it } from 'vitest';
import { rich } from './rich';

describe('rich', () => {
  it('makes bold elements from <b> marks and leaves other text', () => {
    const out = rich('Only a <b>black shield</b> springs <i>it</i>.');
    expect(out).toHaveLength(3);
    expect(out[0]).toBe('Only a ');
    expect((out[1] as { type: string }).type).toBe('b');
    expect(out[2]).toBe(' springs <i>it</i>.');
  });
  it('plain text is one piece', () => {
    expect(rich('hello')).toEqual(['hello']);
  });
});
