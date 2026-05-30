import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../gameState.js';
import { runEffects } from '../../mods/dsl.js';

describe('M133 flag ledger', () => {
  beforeEach(() => {
    GameState.init({ heroName: 'Test', heroClass: 'warrior', attrs: { str:10, dex:10, int:10, con:10 } });
  });
  it('hasFlag returns true only for truthy values', () => {
    GameState.setFlag('foo', true);
    GameState.setFlag('bar', 0);
    GameState.setFlag('baz', 'hi');
    expect(GameState.hasFlag('foo')).toBe(true);
    expect(GameState.hasFlag('bar')).toBe(false);
    expect(GameState.hasFlag('baz')).toBe(true);
    expect(GameState.hasFlag('missing')).toBe(false);
  });
  it('incrementFlag accumulates', () => {
    expect(GameState.incrementFlag('corruption')).toBe(1);
    expect(GameState.incrementFlag('corruption', 4)).toBe(5);
    expect(GameState.getFlag('corruption')).toBe(5);
  });
  it('consumeFlag clears and returns truthiness', () => {
    GameState.setFlag('bessa_owed', true);
    expect(GameState.consumeFlag('bessa_owed')).toBe(true);
    expect(GameState.hasFlag('bessa_owed')).toBe(false);
    expect(GameState.consumeFlag('bessa_owed')).toBe(false);
  });
  it('requireFlags handles AND + negation', () => {
    GameState.setFlag('ally', true);
    expect(GameState.requireFlags([])).toBe(true);
    expect(GameState.requireFlags(['ally'])).toBe(true);
    expect(GameState.requireFlags(['ally','!enemy'])).toBe(true);
    GameState.setFlag('enemy', true);
    expect(GameState.requireFlags(['ally','!enemy'])).toBe(false);
  });
  it('DSL incrementFlag + consumeFlag via gameState', () => {
    const ctx = { gameState: GameState, flags: {} };
    runEffects([{ op:'incrementFlag', flag:'m133_dsl_accum', by:3 }], ctx);
    expect(GameState.getFlag('m133_dsl_accum')).toBe(3);
    GameState.setFlag('one_use_charm', true);
    runEffects([{ op:'consumeFlag', flag:'one_use_charm' }], ctx);
    expect(GameState.hasFlag('one_use_charm')).toBe(false);
  });
  it('DSL requireFlags skips on missing', () => {
    const ctx = { gameState: GameState, flags: {} };
    runEffects([{ op:'requireFlags', flags:['nope'] }], ctx);
    expect(ctx._skip).toBe(true);
  });
});
