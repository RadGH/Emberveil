// Tests for StatColors helper.
import { describe, it, expect } from 'vitest';
import { statColor, BETTER_WHEN, wrapMitigationTags, COLOR_BETTER, COLOR_WORSE } from '../StatColors.js';

describe('statColor', () => {
  it('returns better color when higher-is-better stat is above base', () => {
    expect(statColor(10, 8, 'str')).toBe(COLOR_BETTER);
  });
  it('returns worse color when higher-is-better stat is below base', () => {
    expect(statColor(8, 10, 'str')).toBe(COLOR_WORSE);
  });
  it('returns plain color when equal to base', () => {
    expect(statColor(8, 8, 'str')).toBe('');
  });
  it('returns better color when lower-is-better stat is below base', () => {
    expect(statColor(3, 5, 'cooldown')).toBe(COLOR_BETTER);
  });
  it('returns worse color when lower-is-better stat is above base', () => {
    expect(statColor(6, 5, 'cooldown')).toBe(COLOR_WORSE);
  });
  it('defaults unknown keys to higher-is-better', () => {
    expect(BETTER_WHEN.mysteryStat).toBeUndefined();
    expect(statColor(5, 3, 'mysteryStat')).toBe(COLOR_BETTER);
  });
});

describe('wrapMitigationTags', () => {
  it('wraps deflected', () => {
    expect(wrapMitigationTags('Goblin: deflected')).toContain('data-mit="armor"');
  });
  it('wraps resisted', () => {
    expect(wrapMitigationTags('Lich: resisted')).toContain('data-mit="resist"');
  });
  it('wraps blocked and blocked N', () => {
    expect(wrapMitigationTags('Hero: blocked')).toContain('data-mit="block"');
    expect(wrapMitigationTags('Hero: blocked 7')).toMatch(/data-mit="block">blocked 7</);
  });
});
