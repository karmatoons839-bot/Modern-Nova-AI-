import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { castIsDistinct, changeLineEmotion, orderedComplete, STUDIO_EMOTIONS } from './studio-policy';
import type { StoryLine } from './voice-types';
import { engineVoiceFor, findVoice, buildSpokenPrompt } from './voice-engine.server';

describe('Voice Studio rules', () => {
  it('includes all eleven requested storytelling emotions', () => {
    for (const emotion of ['Happy','Sad','Angry','Scared','Horror','Crying','Whispering','Excited','Surprised','Calm','Suspense']) assert.ok(STUDIO_EMOTIONS.includes(emotion as typeof STUDIO_EMOTIONS[number]));
  });
  it('changing one line leaves every other emotion unchanged', () => {
    const lines: StoryLine[] = [{index:0,character:'A',text:'एक',emotion:'Calm',emotionLocked:true},{index:1,character:'B',text:'दो',emotion:'Sad',emotionLocked:true}];
    const changed = changeLineEmotion(lines, 0, 'Horror');
    assert.equal(changed[0]?.emotion, 'Horror'); assert.equal(changed[1]?.emotion, 'Sad');
  });
  it('requires distinct real engine identities, not distinct profile labels', () => {
    assert.equal(castIsDistinct({A:{voiceId:'1',engineVoice:'Kore'},B:{voiceId:'2',engineVoice:'Kore'}},['A','B']), false);
    assert.equal(castIsDistinct({A:{engineVoice:'Kore'},B:{engineVoice:'Puck'}},['A','B']), true);
  });
  it('exports complete lines in script order', () => {
    assert.deepEqual(orderedComplete([{index:1,status:'done'},{index:0,status:'done'}], [0,1]).map(x=>x.index), [0,1]);
    assert.throws(()=>orderedComplete([{index:0,status:'done'},{index:1,status:'error'}],[0,1]));
  });
  it('keeps a character engine identity deterministic and emotion-specific', () => {
    const profile = findVoice('zvx-voice-0001');
    assert.ok(profile);
    assert.equal(engineVoiceFor(profile), engineVoiceFor({...profile}));
    assert.match(buildSpokenPrompt(profile, 'कौन है वहाँ?', 'Whispering'), /ONE emotion for this line is WHISPERING/);
  });
});