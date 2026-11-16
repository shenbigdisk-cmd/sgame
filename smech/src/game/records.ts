import type { GameStats, VehicleType } from './types';

/** A finished run, kept for the hall of fame in the hangar. */
export interface RunRecord {
  score: number;
  wave: number;
  kills: number;
  timeSurvived: number;
  vehicle: VehicleType;
  seed: string;
  at: number;
}

export const RECORDS_STORAGE_KEY = 'steel-horizon:records:v1';
export const MAX_RECORDS = 8;

export function loadRecords(): RunRecord[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECORDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r): r is RunRecord => !!r && typeof r.score === 'number' && Number.isFinite(r.score))
      .map((r) => ({
        score: Math.max(0, Math.floor(r.score)),
        wave: Math.max(0, Math.floor(r.wave ?? 0)),
        kills: Math.max(0, Math.floor(r.kills ?? 0)),
        timeSurvived: Math.max(0, r.timeSurvived ?? 0),
        vehicle: (r.vehicle ?? 'warden') as VehicleType,
        seed: typeof r.seed === 'string' ? r.seed : '',
        at: typeof r.at === 'number' ? r.at : 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RECORDS);
  } catch {
    return [];
  }
}

export function saveRecords(records: RunRecord[]) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(records.slice(0, MAX_RECORDS)));
  } catch {
    /* storage may be unavailable */
  }
}

/**
 * File a finished run. Returns the updated list and whether it beat the
 * previous personal best.
 */
export function submitRecord(stats: GameStats, records: RunRecord[] = loadRecords()): { records: RunRecord[]; isBest: boolean; rank: number } {
  const best = records.length ? records[0].score : 0;
  const entry: RunRecord = {
    score: Math.max(0, Math.floor(stats.score)),
    wave: Math.max(0, Math.floor(stats.wave)),
    kills: Math.max(0, Math.floor(stats.kills)),
    timeSurvived: Math.max(0, stats.timeSurvived),
    vehicle: stats.vehicle,
    seed: stats.seed,
    at: Date.now(),
  };
  const next = [...records, entry].sort((a, b) => b.score - a.score).slice(0, MAX_RECORDS);
  saveRecords(next);
  return { records: next, isBest: entry.score > best && entry.score > 0, rank: next.findIndex((r) => r === entry) };
}
