import { create } from 'zustand';
import type { DatePosted, JobStatus } from '../types';

// ---------- toasts ----------

type Severity = 'success' | 'error' | 'info' | 'warning';
interface ToastState {
  toast: { id: number; message: string; severity: Severity } | null;
  show: (message: string, severity?: Severity) => void;
  close: () => void;
}
export const useToast = create<ToastState>((set) => ({
  toast: null,
  show: (message, severity = 'success') => set({ toast: { id: Date.now(), message, severity } }),
  close: () => set({ toast: null }),
}));
export const toast = (message: string, severity?: Severity) => useToast.getState().show(message, severity);

export const STATUS_META: Record<JobStatus, { label: string; color: 'default' | 'info' | 'primary' | 'warning' | 'success' | 'error' }> = {
  none: { label: 'No status', color: 'default' },
  interested: { label: 'Interested', color: 'info' },
  applied: { label: 'Applied', color: 'primary' },
  interview: { label: 'Interview', color: 'warning' },
  offer: { label: 'Offer', color: 'success' },
  rejected: { label: 'Rejected', color: 'error' },
};
export const STATUSES = Object.keys(STATUS_META) as JobStatus[];

export function timeAgo(iso: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const days = Math.floor((Date.now() - t) / 86400e3);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export const formatDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export const DATE_OPTIONS: { value: DatePosted; label: string }[] = [
  { value: 'all', label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: '3days', label: 'Last 3 days' },
  { value: 'week', label: 'Last week' },
  { value: 'month', label: 'Last month' },
];

export const EMPLOYMENT_TYPES = [
  { value: 'FULLTIME', label: 'Full-time' },
  { value: 'PARTTIME', label: 'Part-time' },
  { value: 'CONTRACTOR', label: 'Contract' },
  { value: 'INTERN', label: 'Internship' },
];
