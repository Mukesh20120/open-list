// Download (JSON / CSV / Excel) and import (JSON / CSV, incl. the CLI's output/*.csv and output/cache/*.json).
import type { Job, JobStatus, SavedList, Settings } from '../types';
import { normalizeJob, dedupe, type RawJob } from './jsearch';

const FORMAT = 'open-list';
const STATUSES: JobStatus[] = ['none', 'interested', 'applied', 'interview', 'offer', 'rejected'];

// Header names match fetch-jobs.js so both CSVs import into either tool
const CSV_COLUMNS: [header: string, get: (j: Job) => unknown][] = [
  ['score', (j) => j.score],
  ['status', (j) => j.status],
  ['company', (j) => j.company],
  ['job_title', (j) => j.title],
  ['location', (j) => j.location],
  ['remote', (j) => (j.remote ? 'Yes' : 'No')],
  ['experience_required', (j) => j.experience],
  ['matched_skills', (j) => j.matchedSkills.join(', ')],
  ['posted_at', (j) => j.postedAt],
  ['salary', (j) => j.salary],
  ['source', (j) => j.source],
  ['apply_link', (j) => j.applyLink],
  ['company_website', (j) => j.companyWebsite],
  ['search_query', (j) => j.query],
  ['job_id', (j) => j.id],
  ['employment_type', (j) => j.employmentType],
  ['notes', (j) => j.notes],
  ['description', (j) => j.description],
];

export const slug = (s: string) => s.trim().replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'jobs';
const today = () => new Date().toISOString().slice(0, 10);

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- export ----------

export function toCsv(jobs: Job[]): string {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    CSV_COLUMNS.map(([h]) => h).join(','),
    ...jobs.map((j) => CSV_COLUMNS.map(([, get]) => esc(get(j))).join(',')),
  ];
  return '﻿' + lines.join('\r\n'); // BOM so Excel shows special characters correctly
}

export function downloadCsv(name: string, jobs: Job[]) {
  saveBlob(new Blob([toCsv(jobs)], { type: 'text/csv;charset=utf-8' }), `${slug(name)}-${today()}.csv`);
}

export function downloadJson(list: Pick<SavedList, 'name' | 'jobs'> & Partial<SavedList>) {
  const now = new Date().toISOString();
  const payload = {
    format: FORMAT,
    version: 1,
    exportedAt: now,
    list: { id: list.id ?? crypto.randomUUID(), createdAt: list.createdAt ?? now, updatedAt: list.updatedAt ?? now, ...list },
  };
  saveBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `${slug(list.name)}-${today()}.json`);
}

export function downloadBackup(lists: SavedList[]) {
  const payload = { format: FORMAT, version: 1, exportedAt: new Date().toISOString(), lists };
  saveBlob(new Blob([JSON.stringify(payload)], { type: 'application/json' }), `open-list-backup-${today()}.json`);
}

function scoreArgb(score: number, minScore: number) {
  if (score >= 15) return 'FFC6EFCE';
  if (score >= 8) return 'FFFFEB9C';
  if (score >= minScore) return 'FFFCE4D6';
  return 'FFF2F2F2';
}

export async function downloadExcel(name: string, jobs: Job[], minScore: number) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();

  const header = (sheet: import('exceljs').Worksheet) => {
    const row = sheet.getRow(1);
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    row.height = 22;
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
  };
  const link = (url: string, text: string) => (url ? { text, hyperlink: url } : '');
  const linkFont = { color: { argb: 'FF0563C1' }, underline: true };

  const jobsSheet = wb.addWorksheet(`Jobs (${jobs.length})`);
  jobsSheet.columns = [
    { header: 'Score', key: 'score', width: 8 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Company', key: 'company', width: 28 },
    { header: 'Job Title', key: 'title', width: 45 },
    { header: 'Location', key: 'location', width: 22 },
    { header: 'Remote', key: 'remote', width: 9 },
    { header: 'Experience', key: 'experience', width: 14 },
    { header: 'Matched Skills', key: 'skills', width: 40 },
    { header: 'Posted', key: 'posted', width: 12 },
    { header: 'Salary', key: 'salary', width: 16 },
    { header: 'Source', key: 'source', width: 14 },
    { header: 'Apply Link', key: 'apply', width: 12 },
    { header: 'Company Website', key: 'website', width: 16 },
    { header: 'Notes', key: 'notes', width: 30 },
    { header: 'Description', key: 'description', width: 80 },
  ];
  for (const j of jobs) {
    const row = jobsSheet.addRow({
      score: j.score,
      status: j.status === 'none' ? '' : j.status,
      company: j.company,
      title: j.title,
      location: j.location,
      remote: j.remote ? 'Yes' : 'No',
      experience: j.experience,
      skills: j.matchedSkills.join(', '),
      posted: j.postedAt ? new Date(j.postedAt) : '',
      salary: j.salary,
      source: j.source,
      apply: link(j.applyLink, 'Apply'),
      website: link(j.companyWebsite, 'Website'),
      notes: j.notes,
      description: j.description.slice(0, 32000), // Excel cell limit is 32,767 chars
    });
    row.getCell('score').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: scoreArgb(j.score, minScore) } };
    row.getCell('posted').numFmt = 'dd-mmm-yyyy';
    if (j.applyLink) row.getCell('apply').font = linkFont;
    if (j.companyWebsite) row.getCell('website').font = linkFont;
  }
  header(jobsSheet);

  // One row per company, like the CLI's "Companies" sheet
  const companies = new Map<string, { openings: number; best: number; titles: Set<string>; locations: Set<string>; apply: string; website: string }>();
  for (const j of jobs) {
    const key = j.company || '(unknown)';
    const c = companies.get(key) ?? { openings: 0, best: -Infinity, titles: new Set(), locations: new Set(), apply: '', website: '' };
    c.openings++;
    c.titles.add(j.title);
    c.locations.add(j.remote ? 'Remote' : j.location);
    c.website ||= j.companyWebsite;
    if (j.score > c.best) {
      c.best = j.score;
      c.apply = j.applyLink;
    }
    companies.set(key, c);
  }
  const compSheet = wb.addWorksheet('Companies');
  compSheet.columns = [
    { header: 'Company', key: 'company', width: 30 },
    { header: 'Openings', key: 'openings', width: 10 },
    { header: 'Best Score', key: 'best', width: 11 },
    { header: 'Locations', key: 'locations', width: 30 },
    { header: 'Job Titles', key: 'titles', width: 70 },
    { header: 'Best Job Apply Link', key: 'apply', width: 18 },
    { header: 'Website', key: 'website', width: 16 },
  ];
  for (const [company, c] of [...companies].sort((a, b) => b[1].best - a[1].best || b[1].openings - a[1].openings)) {
    const row = compSheet.addRow({
      company,
      openings: c.openings,
      best: c.best,
      locations: [...c.locations].join(', '),
      titles: [...c.titles].join(' | '),
      apply: link(c.apply, 'Apply'),
      website: link(c.website, 'Website'),
    });
    row.getCell('best').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: scoreArgb(c.best, minScore) } };
    if (c.apply) row.getCell('apply').font = linkFont;
    if (c.website) row.getCell('website').font = linkFont;
  }
  header(compSheet);

  const buf = await wb.xlsx.writeBuffer();
  saveBlob(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${slug(name)}-${today()}.xlsx`,
  );
}

// ---------- import ----------

/** RFC 4180 CSV parser (quoted fields, escaped quotes, newlines inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim()));
}

const numOrNull = (v: unknown) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));

/** Fill in any missing fields so imports from older/other files are safe to render. */
export function sanitizeJob(j: Partial<Job>): Job {
  const status = STATUSES.includes(j.status as JobStatus) ? (j.status as JobStatus) : 'none';
  return {
    id: String(j.id || crypto.randomUUID()),
    title: String(j.title ?? ''),
    company: String(j.company ?? ''),
    companyLogo: String(j.companyLogo ?? ''),
    companyWebsite: String(j.companyWebsite ?? ''),
    location: String(j.location ?? ''),
    remote: Boolean(j.remote),
    employmentType: String(j.employmentType ?? ''),
    postedAt: String(j.postedAt ?? ''),
    salary: String(j.salary ?? ''),
    salaryMin: numOrNull(j.salaryMin),
    salaryMax: numOrNull(j.salaryMax),
    source: String(j.source ?? ''),
    applyLink: String(j.applyLink ?? ''),
    description: String(j.description ?? ''),
    experience: String(j.experience ?? ''),
    experienceMin: numOrNull(j.experienceMin),
    matchedSkills: Array.isArray(j.matchedSkills) ? j.matchedSkills.map(String) : [],
    score: Number(j.score) || 0,
    query: String(j.query ?? ''),
    fetchedAt: String(j.fetchedAt ?? ''),
    status,
    notes: String(j.notes ?? ''),
  };
}

function jobsFromCsv(text: string): Job[] {
  const [head, ...rows] = parseCsv(text);
  if (!head) return [];
  const idx = Object.fromEntries(head.map((h, i) => [h.trim().toLowerCase(), i]));
  if (idx.job_title === undefined && idx.company === undefined) throw new Error('CSV has no "job_title" or "company" column.');
  const get = (r: string[], k: string) => (idx[k] === undefined ? '' : (r[idx[k]] ?? ''));
  return rows.map((r) => {
    const exp = get(r, 'experience_required');
    return sanitizeJob({
      id: get(r, 'job_id'),
      title: get(r, 'job_title'),
      company: get(r, 'company'),
      location: get(r, 'location'),
      remote: /^(yes|true|1)$/i.test(get(r, 'remote')),
      experience: exp,
      experienceMin: numOrNull(exp.match(/\d+/)?.[0]),
      matchedSkills: get(r, 'matched_skills').split(',').map((s) => s.trim()).filter(Boolean),
      postedAt: get(r, 'posted_at'),
      salary: get(r, 'salary'),
      source: get(r, 'source'),
      applyLink: get(r, 'apply_link'),
      companyWebsite: get(r, 'company_website'),
      query: get(r, 'search_query'),
      employmentType: get(r, 'employment_type'),
      notes: get(r, 'notes'),
      description: get(r, 'description'),
      score: Number(get(r, 'score')) || 0,
      status: (get(r, 'status') || 'none') as JobStatus,
    });
  });
}

/** Returns one or more lists parsed from an uploaded file. */
export async function importFile(file: File, settings: Settings): Promise<SavedList[]> {
  const text = await file.text();
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const now = new Date().toISOString();
  const wrap = (name: string, jobs: Job[]): SavedList => ({
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    jobs: dedupe(jobs),
  });

  if (/\.csv$/i.test(file.name) || /^﻿?"?[a-z_]+"?,/i.test(text)) {
    return [wrap(baseName, jobsFromCsv(text))];
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('File is neither valid JSON nor CSV.');
  }
  const d = data as Record<string, unknown>;

  const toList = (l: Partial<SavedList>, fallbackName: string): SavedList => ({
    ...wrap(String(l.name || fallbackName), (Array.isArray(l.jobs) ? l.jobs : []).map(sanitizeJob)),
    createdAt: String(l.createdAt || now),
  });

  if (d?.format === FORMAT && d.list) return [toList(d.list as Partial<SavedList>, baseName)];
  if (d?.format === FORMAT && Array.isArray(d.lists)) return (d.lists as Partial<SavedList>[]).map((l, i) => toList(l, `${baseName} ${i + 1}`));
  // CLI cache file: { query, fetchedAt, jobs: [raw JSearch jobs] }
  if (Array.isArray(d?.jobs) && (d.jobs as RawJob[]).some((j) => j && 'job_title' in j)) {
    const q = String(d.query ?? '');
    return [wrap(q || baseName, (d.jobs as RawJob[]).map((j) => normalizeJob(j, q, settings)))];
  }
  if (Array.isArray(data)) {
    const arr = data as Record<string, unknown>[];
    if (arr.some((j) => j && 'job_title' in j)) return [wrap(baseName, (arr as RawJob[]).map((j) => normalizeJob(j, '', settings)))];
    return [wrap(baseName, arr.map((j) => sanitizeJob(j as Partial<Job>)))];
  }
  throw new Error('Unrecognised JSON: expected an Open List export, a jobs array, or a JSearch cache file.');
}
