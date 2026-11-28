import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { ageCategory, pickCastVoices } from './voice-cast';
import { allVoices, decorate, engineVoiceFor } from './voice-engine.server';
import { voiceAllowed } from './plans';

const voices = allVoices().map(decorate);
const engineOf = (v: (typeof voices)[number]) => v.engineVoice ?? engineVoiceFor(v);
const hindi = (plan: 'free' | 'creator' | 'pro' | 'premium') => ({
  allowed: (id: string) => voiceAllowed(id, plan),
  engineOf,
  language: 'Hindi',
});

describe('Automatic character voice casting', () => {
  it('gives two adult male characters two distinct real engine voices', () => {
    const picks = pickCastVoices(
      [
        { name: 'Rohan', gender: 'Male', age: 30 },
        { name: 'Vikram', gender: 'Male', age: 35 },
      ],
      voices,
      hindi('premium'),
    );
    assert.ok(picks[0] && picks[1]);
    assert.notEqual(picks[0].engineVoice, picks[1].engineVoice);
    assert.equal(picks[0].gender, 'Male');
    assert.equal(picks[1].gender, 'Male');
  });

  it('casts a child girl from child-aged profiles only', () => {
    const [pick] = pickCastVoices([{ name: 'Chotu', gender: 'Female', age: 8 }], voices, hindi('premium'));
    assert.ok(pick);
    assert.equal(pick.gender, 'Female');
    assert.ok(pick.age >= 6 && pick.age <= 12, `expected a child profile, got age ${pick.age}`);
  });

  it('casts an elderly narrator from elderly profiles', () => {
    const [pick] = pickCastVoices([{ name: 'Dada', gender: 'Male', age: 70 }], voices, hindi('premium'));
    assert.ok(pick);
    assert.ok(pick.age >= 60, `expected an elderly profile, got age ${pick.age}`);
  });

  it('never suggests a voice outside the user plan', () => {
    for (const plan of ['free', 'creator', 'pro'] as const) {
      const picks = pickCastVoices(
        [
          { name: 'A', gender: 'Female', age: 25 },
          { name: 'B', gender: 'Male', age: 40 },
        ],
        voices,
        hindi(plan),
      );
      for (const pick of picks) {
        assert.ok(pick, `${plan} plan should have a voice for every common character`);
        assert.ok(voiceAllowed(pick.voiceId, plan), `${pick.voiceId} must be allowed on ${plan}`);
      }
    }
  });

  it('returns null instead of reusing an engine voice when the child pool is exhausted', () => {
    const characters = [1, 2, 3, 4].map((n) => ({ name: `Girl${n}`, gender: 'Female' as const, age: 8 }));
    const picks = pickCastVoices(characters, voices, hindi('premium'));
    const engines = picks.filter(Boolean).map((p) => p?.engineVoice);
    assert.equal(new Set(engines).size, engines.length);
    assert.ok(picks.some((p) => p === null), 'fourth child girl must wait for a manual choice');
  });

  it('handles unknown gender by picking any distinct voice in the age range', () => {
    const [pick] = pickCastVoices([{ name: 'Narrator', gender: 'any', age: 30 }], voices, hindi('free'));
    assert.ok(pick);
    assert.ok(pick.age >= 26 && pick.age <= 59);
    assert.equal(ageCategory(8), 'Child');
    assert.equal(ageCategory(20), 'Young');
    assert.equal(ageCategory(45), 'Adult');
    assert.equal(ageCategory(70), 'Elderly');
  });
});

import { narratorGender as ng, isNarrator as isN } from './voice-cast';
import { test as t2, expect as e2 } from 'vitest';
t2('horror story narrator is male', () => e2(ng('horror')).toBe('Male'));
t2('moral story narrator is female', () => e2(ng('moral')).toBe('Female'));
t2('other stories leave narrator to AI', () => e2(ng('other')).toBeNull());
t2('narrator names recognised', () => { e2(isN('Narrator')).toBe(true); e2(isN('नैरेटर')).toBe(true); e2(isN('Rohan')).toBe(false); });
