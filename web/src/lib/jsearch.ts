// Browser client for the JSearch API on RapidAPI (same endpoint as fetch-jobs.js).
import type { Job, QuotaHeaders, SearchRequest, Settings } from '../types';
import { scoreJob } from './scoring';

// Only the fields we read from the raw API response
export interface RawJob {
  job_id?: string;
  job_title?: string;
  employer_name?: string;
  employer_logo?: string | null;
  employer_website?: string | null;
  job_publisher?: string;
  job_employment_type?: string;
  job_apply_link?: string;
  job_description?: string;
  job_is_remote?: boolean;
  job_posted_at_datetime_utc?: string;
  job_location?: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_min_salary?: number | null;
  job_max_salary?: number | null;
  job_salary_period?: string | null;
}

export class ApiError extends Error {}

export function normalizeJob(raw: RawJob, query: string, settings: Settings): Job {
  const title = raw.job_title ?? '';
  const description = raw.job_description ?? '';
  const { score, matchedSkills, exp } = scoreJob({ title, description }, settings);
  const min = raw.job_min_salary ?? null;
  const max = raw.job_max_salary ?? null;
  const salary =
    min || max ? `${min ?? '?'} - ${max ?? '?'} ${raw.job_salary_period ?? ''}`.trim() : '';
  return {
    id: raw.job_id || `${raw.employer_name}|${title}|${raw.job_city ?? ''}`,
    title,
    company: raw.employer_name ?? '',
    companyLogo: raw.employer_logo ?? '',
    companyWebsite: raw.employer_website ?? '',
    location: raw.job_location || [raw.job_city, raw.job_state].filter(Boolean).join(', '),
    remote: Boolean(raw.job_is_remote),
    employmentType: raw.job_employment_type ?? '',
    postedAt: raw.job_posted_at_datetime_utc ?? '',
    salary,
    salaryMin: min,
    salaryMax: max,
    source: raw.job_publisher ?? '',
    applyLink: raw.job_apply_link ?? '',
    description,
    experience: exp?.text ?? '',
    experienceMin: exp?.min ?? null,
    matchedSkills,
    score,
    query,
    fetchedAt: new Date().toISOString(),
    status: 'none',
    notes: '',
  };
}

export async function searchJobs(
  apiKey: string,
  req: SearchRequest,
  settings: Settings,
  signal?: AbortSignal,
  onCharged?: (pages: number, headers: QuotaHeaders | null) => void,
): Promise<Job[]> {
  const params = new URLSearchParams({
    query: req.query,
    page: '1',
    num_pages: String(req.numPages),
    country: req.country,
    language: req.language,
    date_posted: req.datePosted,
  });
  if (req.employmentTypes.length) params.set('employment_types', req.employmentTypes.join(','));
  if (req.remoteOnly) params.set('work_from_home', 'true');

  let res: Response;
  try {
    res = await fetch(`https://jsearch.p.rapidapi.com/search-v2?${params}`, {
      headers: { 'x-rapidapi-key': apiKey, 'x-rapidapi-host': 'jsearch.p.rapidapi.com' },
      signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError('Network error: could not reach the JSearch API.');
  }

  // Billed per page once the request succeeds. Use the exact quota headers when RapidAPI sends them.
  if (res.ok) {
    const remaining = res.headers.get('x-ratelimit-requests-remaining');
    const limit = Number(res.headers.get('x-ratelimit-requests-limit'));
    const headers = remaining !== null && Number.isFinite(Number(remaining)) ? { remaining: Number(remaining), limit: limit || null } : null;
    onCharged?.(req.numPages, headers);
  }

  if (res.status === 401 || res.status === 403)
    throw new ApiError('Forbidden: check your API key and that you are subscribed to JSearch on RapidAPI.');
  if (res.status === 429) throw new ApiError('Too many requests: rate limit or monthly quota reached.');
  if (!res.ok) throw new ApiError(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const json = await res.json();
  if (json.status !== 'OK') throw new ApiError(`API error: ${json.error?.message ?? JSON.stringify(json).slice(0, 300)}`);
  const data = json.data?.jobs ?? json.data; // search-v2 returns { data: { jobs, cursor } }
  const raw: RawJob[] = Array.isArray(data) ? data : [];
  return dedupe(raw.map((j) => normalizeJob(j, req.query, settings)));
}

export function dedupe(jobs: Job[]): Job[] {
  const byId = new Map<string, Job>();
  for (const j of jobs) if (!byId.has(j.id)) byId.set(j.id, j);
  return [...byId.values()];
}
