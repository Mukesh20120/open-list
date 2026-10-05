// Scoring ported from fetch-jobs.js, with the profile made editable in Settings.
import type { Job, Settings, WeightedKeyword } from '../types';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const regexCache = new Map<string, RegExp | null>();

/** "node|nodejs|node.js" -> /\b(?:node|nodejs|node\.js)\b/i. Edges that aren't word chars (".net", "c#") skip \b. */
export function keywordRegex(keyword: string): RegExp | null {
  if (regexCache.has(keyword)) return regexCache.get(keyword)!;
  const parts = keyword
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const start = /^\w/.test(p) ? '\\b' : '';
      const end = /\w$/.test(p) ? '\\b' : '';
      return `${start}${escapeRe(p)}${end}`;
    });
  const re = parts.length ? new RegExp(`(?:${parts.join('|')})`, 'i') : null;
  regexCache.set(keyword, re);
  return re;
}

/** First "N years" / "N-M years" / "N+ years" mention in the description (heuristic). */
export function experienceRequired(description: string) {
  const m = (description || '').match(/(\d{1,2})\s*(?:\+|-|–|to)?\s*(\d{1,2})?\s*\+?\s*(?:years?|yrs?)/i);
  if (!m) return null;
  const min = Number(m[1]);
  const max = m[2] ? Number(m[2]) : null;
  return min > 20 ? null : { min, max, text: m[0].trim() };
}

export function scoreJob(job: Pick<Job, 'title' | 'description'>, settings: Settings) {
  const title = job.title || '';
  const text = `${title}\n${job.description || ''}`;
  let score = 0;
  const matched: string[] = [];

  for (const { keyword, weight } of settings.skills) {
    const m = keywordRegex(keyword)?.exec(text);
    if (m) {
      score += weight;
      matched.push(m[0].toLowerCase());
    }
  }
  for (const { keyword, weight } of settings.titlePenalties) {
    if (keywordRegex(keyword)?.test(title)) score -= Math.abs(weight);
  }

  const exp = experienceRequired(job.description);
  if (exp) {
    const gap = exp.min - settings.yearsExperience;
    if (gap <= 1) score += 2; // meets or nearly meets the minimum
    else if (gap >= 3) score -= 3; // asks for much more experience
    if (exp.max !== null && exp.max < settings.yearsExperience - 1) score -= 2; // junior band
  }
  return { score, matchedSkills: [...new Set(matched)], exp };
}

export function rescore(job: Job, settings: Settings): Job {
  if (!job.description) return job; // e.g. imported from a CSV without descriptions: keep its original score
  const { score, matchedSkills } = scoreJob(job, settings);
  return { ...job, score, matchedSkills };
}

export const DEFAULT_SKILLS: WeightedKeyword[] = [
  { keyword: 'node|nodejs|node.js', weight: 3 },
  { keyword: 'react|reactjs|react.js', weight: 3 },
  { keyword: 'next.js|nextjs', weight: 2 },
  { keyword: 'express|expressjs|express.js', weight: 2 },
  { keyword: 'mern', weight: 3 },
  { keyword: 'javascript', weight: 2 },
  { keyword: 'typescript', weight: 1 },
  { keyword: 'react native', weight: 2 },
  { keyword: 'graphql', weight: 1 },
  { keyword: 'mongo|mongodb', weight: 1 },
  { keyword: 'postgres|postgresql', weight: 1 },
  { keyword: 'redis', weight: 1 },
  { keyword: 'websocket|websockets', weight: 1 },
  { keyword: 'redux', weight: 1 },
  { keyword: 'tailwind', weight: 1 },
  { keyword: 'openai|llm|llms|genai|generative ai|gen ai|ai agent|ai agents|agentic|langchain|rag', weight: 2 },
  { keyword: 'n8n', weight: 1 },
  { keyword: 'playwright', weight: 1 },
  { keyword: 'aws', weight: 1 },
  { keyword: 'docker', weight: 1 },
];

export const DEFAULT_TITLE_PENALTIES: WeightedKeyword[] = [
  { keyword: 'java', weight: 3 },
  { keyword: '.net|c#', weight: 4 },
  { keyword: 'php|laravel', weight: 4 },
  { keyword: 'angular', weight: 2 },
  { keyword: 'python|django', weight: 2 },
  { keyword: 'salesforce|sap|wordpress|shopify', weight: 4 },
  { keyword: 'lead|architect|principal|manager|head', weight: 3 },
  { keyword: 'intern|internship|trainee|fresher', weight: 4 },
];
