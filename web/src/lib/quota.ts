// RapidAPI no longer sends quota headers (x-ratelimit-requests-*) reliably, so usage is counted here:
// every successful search adds its page count, and the count resets on the plan's monthly reset day.
import type { Settings, Usage } from '../types';

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The reset day clamped to the month's length (e.g. day 31 in February -> 28/29). */
function resetDate(year: number, month: number, resetDay: number) {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(resetDay, last));
}

export function cycleStart(resetDay: number, now = new Date()): Date {
  const thisMonth = resetDate(now.getFullYear(), now.getMonth(), resetDay);
  return now >= thisMonth ? thisMonth : resetDate(now.getFullYear(), now.getMonth() - 1, resetDay);
}

export function nextReset(resetDay: number, now = new Date()): Date {
  const start = cycleStart(resetDay, now);
  return resetDate(start.getFullYear(), start.getMonth() + 1, resetDay);
}

export const currentCycleKey = (resetDay: number, now = new Date()) => ymd(cycleStart(resetDay, now));

export function usageView(usage: Usage, settings: Pick<Settings, 'monthlyLimit' | 'resetDay'>) {
  const fresh = usage.cycleKey === currentCycleKey(settings.resetDay);
  const used = fresh ? usage.used : 0;
  const limit = settings.monthlyLimit;
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    resetsAt: nextReset(settings.resetDay),
    exact: fresh && usage.syncedAt !== null, // synced from headers or entered from the dashboard
    syncedAt: fresh ? usage.syncedAt : null,
  };
}

export const RAPIDAPI_USAGE_URL = 'https://rapidapi.com/developer/billing/subscriptions-and-usage';
