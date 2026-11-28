import { describe, expect, it } from 'vitest';
import { allVoices, buildSpokenPrompt, decorate, engineVoiceFor, ENGINE_VOICE_COUNT } from './voice-engine.server';
import { pickCastVoices } from './voice-cast';

describe('real voice identity', () => {
  it('shared base timbres receive different stable profile direction without changing the catalog', () => {
    const profiles = allVoices();
    const first = profiles.find(v => v.age > 17);
    expect(first).toBeDefined();
    if (!first) throw new Error('Missing catalog profile');
    const other = profiles.find(v => v.voiceId !== first.voiceId && v.age > 17 && engineVoiceFor(v) === engineVoiceFor(first));
    if (!other) throw new Error('Missing shared engine profile');
    expect(buildSpokenPrompt(first,'Hello','Calm')).not.toBe(buildSpokenPrompt(other,'Hello','Calm'));
    expect(ENGINE_VOICE_COUNT).toBe(30);
    expect(profiles).toHaveLength(400);
  });
  it('moral female narrators never fall back to a male when female timbres are exhausted', () => {
    const voices = allVoices().map(decorate);
    const picks = pickCastVoices(Array.from({length:35},(_,i)=>({name:`Narrator${i}`,gender:'Female' as const,age:30})), voices, {allowed:()=>true,engineOf:engineVoiceFor,language:'Hindi'});
    expect(picks.some(p=>p === null)).toBe(true);
    for (const pick of picks) if (pick) expect(pick.gender).toBe('Female');
    const engines = picks.flatMap(p => p ? [p.engineVoice] : []);
    expect(new Set(engines).size).toBe(engines.length);
  });
});