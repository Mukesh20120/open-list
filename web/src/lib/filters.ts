import type { Job, JobStatus } from '../types';

export interface Filters {
  text: string;
  goodOnly: boolean;
  remote: 'any' | 'remote' | 'onsite';
  postedWithin: number; // days, 0 = any
  sources: string[];
  statuses: JobStatus[];
  newOnly: boolean;
  hasSalary: boolean;
}

export const EMPTY_FILTERS: Filters = {
  text: '',
  goodOnly: false,
  remote: 'any',
  postedWithin: 0,
  sources: [],
  statuses: [],
  newOnly: false,
  hasSalary: false,
};

export function activeFilterCount(f: Filters) {
  return [f.text.trim(), f.goodOnly, f.remote !== 'any', f.postedWithin, f.sources.length, f.statuses.length, f.newOnly, f.hasSalary].filter(Boolean).length;
}

export function applyFilters(jobs: Job[], f: Filters, ctx: { minScore: number; newIds: Set<string> }): Job[] {
  const terms = f.text.toLowerCase().split(/\s+/).filter(Boolean);
  const cutoff = f.postedWithin ? Date.now() - f.postedWithin * 86400e3 : 0;
  return jobs.filter((j) => {
    if (f.goodOnly && j.score < ctx.minScore) return false;
    if (f.remote === 'remote' && !j.remote) return false;
    if (f.remote === 'onsite' && j.remote) return false;
    if (cutoff && (!j.postedAt || new Date(j.postedAt).getTime() < cutoff)) return false;
    if (f.sources.length && !f.sources.includes(j.source)) return false;
    if (f.statuses.length && !f.statuses.includes(j.status)) return false;
    if (f.newOnly && !ctx.newIds.has(j.id)) return false;
    if (f.hasSalary && !j.salary) return false;
    if (terms.length) {
      const hay = `${j.title} ${j.company} ${j.location} ${j.matchedSkills.join(' ')} ${j.description} ${j.notes}`.toLowerCase();
      if (!terms.every((t) => hay.includes(t))) return false;
    }
    return true;
  });
}
