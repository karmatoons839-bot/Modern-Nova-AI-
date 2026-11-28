import { describe, expect, it } from 'vitest';
import { applyCharacterLabels, emotionBatches, MAX_STORY_CHARS, screenplayTags, splitStorySections, spokenUnits, storyUnits, validateStory } from './story-processing';
import { processStory } from './story-workflow';

const hindi = 'अध्याय १ — शुरुआत\nआरव: “मैं लौटकर आऊँगा। मेरी बहन मीरा मेरा इंतज़ार करेगी।”\nमीरा: “तुम्हारा वादा याद रखूँगी!”\n';
function fixture(size: number) { return hindi.repeat(Math.ceil(size / hindi.length)).slice(0, size); }

describe('long story preservation', () => {
  it('turns repeated screenplay names into casting tags, not spoken dialogue', () => {
    const script = 'The Last Call\n\nनैरेटर\nरात के तीन बजे थे।\n\nअनन्या\nमाँ?\n\nनैरेटर\nफोन बजा।';
    expect(screenplayTags(script)).toBe('The Last Call\n\n[नैरेटर]\nरात के तीन बजे थे।\n\n[अनन्या]\nमाँ?\n\n[नैरेटर]\nफोन बजा।');
    expect(script).toContain('\nनैरेटर\n');
  });
  it('leaves ordinary prose and existing tagged scripts unchanged', () => {
    for (const script of ['रात\nअँधेरा छाया था।', '[Narrator]\nरात के तीन बजे थे।']) expect(screenplayTags(script)).toBe(script);
  });
  for (const size of [10_000, 20_000, 30_000, 50_001]) {
    it(`accepts and losslessly processes ${size} Hindi characters`, async () => {
      const original = fixture(size);
      expect(validateStory(original)).toBe(original);
      const chunks = splitStorySections(original);
      expect(chunks.join('')).toBe(original);
      expect(chunks.every(s => s.length <= 6000)).toBe(true);
      let inFlight = 0, calls = 0;
      const completed: number[] = [];
      const result = await processStory(original, false, async data => {
        inFlight += 1; expect(inFlight).toBe(1); calls += 1;
        await Promise.resolve();
        const units = storyUnits(data.script);
        const lines = applyCharacterLabels(units, units.map((_, index) => ({ index, character: 'Narrator' })));
        inFlight -= 1;
        return { lines, continuationCharacter: 'Narrator', continuationEmotion: null };
      }, async () => { throw new Error('Must not add emotions when off'); }, p => completed.push(p.completed));
      expect(result.lines.map(l => l.text).join('')).toBe(original);
      expect(result.lines.map(l => l.index)).toEqual(result.lines.map((_, i) => i));
      expect(calls).toBe(chunks.length);
      expect(completed.at(-1)).toBe(chunks.length);
    });
  }
  it('accepts 500,000 and rejects above the actual shared envelope without trimming', () => {
    expect(validateStory(fixture(MAX_STORY_CHARS)).length).toBe(500_000);
    expect(() => validateStory(fixture(MAX_STORY_CHARS + 1))).toThrow('Processing limit reached');
    expect(validateStory('  कहानी\n')).toBe('  कहानी\n');
  });
  it('preserves chapter order, long dialogues and emoji, with voice-safe units', () => {
    const story = 'अध्याय १\n' + 'मीरा: ' + 'बहुत लंबा संवाद 😊 '.repeat(1500) + '\nअध्याय २\nआरव वापस आया।';
    expect(splitStorySections(story).join('')).toBe(story);
    expect(storyUnits(story).join('')).toBe(story);
    expect(storyUnits(story).every(l => l.length <= 3000)).toBe(true);
  });
  it('rejects omitted model indices rather than silently losing dialogue', () => {
    expect(() => applyCharacterLabels(['अध्याय १\n', 'मीरा बोलती है।'], [{ index: 0, character: 'Narrator' }])).toThrow('not analyzed');
  });
  it('keeps closing quotes and blank lines without creating empty spoken lines', () => {
    const text = '\n\nमीरा: “मैं लौटूँगी।”\n\nआरव: “ठीक है!”\n';
    const units = storyUnits(text);
    expect(units.join('')).toBe(text);
    expect(units.every(u => /[\p{L}\p{N}]/u.test(u))).toBe(true);
  });
  it('spokenUnits drops blank separator units while storyUnits stays lossless', () => {
    const text = 'रात के बारह बजे थे।\n\n\nकौन है वहाँ?\n';
    expect(storyUnits(text).join('')).toBe(text);
    const spoken = spokenUnits(text);
    expect(spoken.length).toBe(2);
    expect(spoken.every(u => u.trim().length > 0)).toBe(true);
    expect(spoken.join('')).toContain('रात के बारह बजे थे।');
    expect(spoken.join('')).toContain('कौन है वहाँ?');
  });
  it('reuses established character names without modifying source text', () => {
    expect(applyCharacterLabels(['Hello.'], [{ index: 0, character: 'aarav' }], ['Aarav'])[0]).toMatchObject({ character: 'Aarav', text: 'Hello.' });
  });
  it('batches over 300 lines without dropping any, and only tags unlocked lines', async () => {
    const script = 'संवाद।\n'.repeat(650);
    const inputs: number[] = [];
    const result = await processStory(script, true, async data => ({
      lines: storyUnits(data.script).map((text, index) => ({ index, text, character: 'मीरा', emotion: null, emotionLocked: false })),
      continuationCharacter: 'मीरा', continuationEmotion: null,
    }), async data => { inputs.push(data.lines.length); return { emotions: data.lines.map(l => ({ index: l.index, emotion: 'Happy' })), missing: [] }; }, () => {});
    expect(result.lines.map(l => l.text).join('')).toBe(script);
    expect(result.lines.length).toBeGreaterThan(300);
    expect(inputs.every(n => n <= 40)).toBe(true);
    expect(result.lines.every(l => l.emotion === 'Happy' && l.emotionLocked)).toBe(true);
    expect(emotionBatches(result.lines).flat()).toEqual(result.lines);
  });
  it('stops sequential work on failure and never returns a partial story', async () => {
    let calls = 0;
    const original = fixture(30_000);
    await expect(processStory(original, false, async data => {
      calls += 1;
      if (calls === 2) throw new Error('Provider denied');
      return { lines: applyCharacterLabels([data.script], [{ index: 0, character: 'Narrator' }]), continuationCharacter: 'Narrator', continuationEmotion: null };
    }, async () => ({ emotions: [], missing: [] }), () => {})).rejects.toThrow('Provider denied');
    expect(calls).toBe(2);
    expect(original.length).toBe(30_000);
  });
});