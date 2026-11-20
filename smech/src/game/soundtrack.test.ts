import { describe, expect, it } from 'vitest';
import { SoundtrackDirector } from './soundtrack';

describe('SoundtrackDirector', () => {
  it('instantiates cleanly without throwing in tests', () => {
    const director = new SoundtrackDirector();
    expect(director).toBeDefined();
  });

  it('updates mood and intensity safely', () => {
    const director = new SoundtrackDirector();
    expect(() => {
      director.setMood('hangar');
      director.setMood('patrol');
      director.setMood('combat');
      director.setMood('boss');
      director.setIntensity(0.85);
    }).not.toThrow();
  });

  it('handles volume and mute toggles', () => {
    const director = new SoundtrackDirector();
    expect(() => {
      director.setVolume(0.8);
      director.setMuted(true);
      director.setMuted(false);
    }).not.toThrow();
  });

  it('disposes resources cleanly', () => {
    const director = new SoundtrackDirector();
    expect(() => director.dispose()).not.toThrow();
  });
});
