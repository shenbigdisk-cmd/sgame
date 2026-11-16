import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_RECORDS, RECORDS_STORAGE_KEY, loadRecords, saveRecords, submitRecord } from './records';
import type { GameStats } from './types';

const stats = (score: number, wave = 1): GameStats => ({
  score,
  wave,
  kills: wave * 3,
  timeSurvived: 60 * wave,
  vehicle: 'warden',
  perks: [],
  seed: 'ABC-123',
  zone: 0,
});

describe('hall of fame', () => {
  beforeEach(() => localStorage.clear());

  it('is empty on a fresh install', () => {
    expect(loadRecords()).toEqual([]);
  });

  it('files a run and flags a new personal best', () => {
    const { records, isBest, rank } = submitRecord(stats(1200));
    expect(records).toHaveLength(1);
    expect(isBest).toBe(true);
    expect(rank).toBe(0);
  });

  it('does not flag a personal best when the score is lower', () => {
    submitRecord(stats(5000));
    const { records, isBest, rank } = submitRecord(stats(1200));
    expect(isBest).toBe(false);
    expect(rank).toBe(1);
    expect(records[0].score).toBe(5000);
  });

  it('sorts by score and caps the list', () => {
    for (let i = 1; i <= MAX_RECORDS + 4; i++) submitRecord(stats(i * 100));
    const records = loadRecords();
    expect(records).toHaveLength(MAX_RECORDS);
    expect(records[0].score).toBe((MAX_RECORDS + 4) * 100);
    for (let i = 1; i < records.length; i++) expect(records[i - 1].score).toBeGreaterThanOrEqual(records[i].score);
  });

  it('ignores malformed stored data', () => {
    localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify([{ nope: true }, null, 7]));
    expect(loadRecords()).toEqual([]);
    localStorage.setItem(RECORDS_STORAGE_KEY, 'not json at all');
    expect(loadRecords()).toEqual([]);
  });

  it('persists what it saves', () => {
    saveRecords([{ score: 42, wave: 2, kills: 5, timeSurvived: 30, vehicle: 'pyre', seed: 'X', at: 1 }]);
    expect(loadRecords()[0].score).toBe(42);
  });
});
