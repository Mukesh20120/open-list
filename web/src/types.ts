export type JobStatus = 'none' | 'interested' | 'applied' | 'interview' | 'offer' | 'rejected';

/** A job flattened from the JSearch response. This is what gets stored, exported and imported. */
export interface Job {
  id: string;
  title: string;
  company: string;
  companyLogo: string;
  companyWebsite: string;
  location: string;
  remote: boolean;
  employmentType: string;
  postedAt: string; // ISO date or ''
  salary: string;
  salaryMin: number | null;
  salaryMax: number | null;
  source: string;
  applyLink: string;
  description: string;
  experience: string;
  experienceMin: number | null;
  matchedSkills: string[];
  score: number;
  query: string;
  fetchedAt: string;
  status: JobStatus;
  notes: string;
}

export interface SavedList {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  jobs: Job[];
}

export interface WeightedKeyword {
  keyword: string; // "node|nodejs|node.js": alternatives separated by |
  weight: number;
}

export type DatePosted = 'all' | 'today' | '3days' | 'week' | 'month';

export interface Settings {
  country: string;
  language: string;
  datePosted: DatePosted;
  employmentTypes: string[];
  numPages: number;
  yearsExperience: number;
  minScore: number;
  monthlyLimit: number; // requests per month on the RapidAPI plan (free plan: 200)
  resetDay: number; // day of month the RapidAPI quota resets (= the day you subscribed)
  skills: WeightedKeyword[];
  titlePenalties: WeightedKeyword[];
}

export interface SearchRequest {
  query: string;
  remoteOnly: boolean;
  datePosted: DatePosted;
  employmentTypes: string[];
  numPages: number;
  country: string;
  language: string;
}

/** Exact quota, only when RapidAPI sends x-ratelimit-requests-* headers (it often doesn't). */
export interface QuotaHeaders {
  remaining: number;
  limit: number | null;
}

/** API requests used in the current billing cycle (each page of 10 jobs = 1 request). */
export interface Usage {
  used: number;
  cycleKey: string; // start date of the cycle this count belongs to
  syncedAt: string | null; // last time the count was set from headers or by the user
}
