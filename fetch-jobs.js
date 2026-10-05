// fetch-jobs.js
// Pulls job openings from the JSearch API (RapidAPI), scores them against your profile, and saves CSVs.
// Requires Node 18+ (uses built-in fetch). No npm packages needed.
//
// Run:
//   node fetch-jobs.js --dry-run   show planned requests + estimated quota cost, makes NO requests
//   node fetch-jobs.js             fetch (uses cache if a search was fetched in the last cacheHours)
//   node fetch-jobs.js --offline   rebuild CSVs from cached responses only, makes NO requests
//
// Quota: RapidAPI sends x-ratelimit-requests-remaining on every response; the script saves it to
// output/quota.json and refuses to run if the planned cost would dip below CONFIG.reserveRequests.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ================== CONFIG: edit this section ==================
const CONFIG = {
  // One API call per search; it returns up to numPages * 10 jobs and costs numPages requests.
  searches: [
    { query: "full stack developer in Delhi" },
    { query: "full stack developer in Noida" },
    { query: "full stack developer in Gurugram" },
    { query: "remote full stack developer India", remote: true },
    // Extra searches that fit your profile; uncomment when you have quota to spare:
    // { query: "node.js react developer in Delhi NCR" },
    // { query: "AI engineer node.js in Noida" },
  ],

  country: "in",
  language: "en",
  datePosted: "month",        // ONE of: "all" | "today" | "3days" | "week" | "month". Use "week" for weekly runs.
  employmentTypes: "FULLTIME", // "" for any, or e.g. "FULLTIME,CONTRACTOR"

  numPages: 5,                // pages per search (10 jobs each). COSTS 1 REQUEST PER PAGE; later pages are less relevant.
  monthlyLimit: 200,
  reserveRequests: 20,        // never plan a run that would leave fewer than this many requests
  cacheHours: 24,             // re-running within this window reuses saved responses (0 = always fetch)
  delayMs: 1200,

  // Jobs outside these places are dropped unless the job is remote.
  allowedLocations: ["delhi", "new delhi", "noida", "greater noida", "gurugram", "gurgaon", "ncr"], // matched in location + title
  allowedStateCodes: ["DL"],  // whole state counts (Delhi). "UP"/"HR" are too broad, so those need a city match.
  minScore: 3,                // jobs scoring below this go to the "rejected" CSV instead of the main one
};

// Scoring profile (Mukesh Sharma: Full-Stack & AI Engineer, 3+ yrs, JS/Node/React/Next.js, OpenAI, n8n, Playwright)
const PROFILE = {
  yearsExperience: 3,
  // [regex, weight] matched against title + description
  skills: [
    [/\bnode(\.?js)?\b/i, 3], [/\breact(\.?js)?\b/i, 3], [/\bnext\.?js\b/i, 2], [/\bexpress(\.?js)?\b/i, 2],
    [/\bmern\b/i, 3], [/\bjavascript\b/i, 2], [/\btypescript\b/i, 1], [/\breact native\b/i, 2],
    [/\bgraphql\b/i, 1], [/\bmongo(db)?\b/i, 1], [/\bpostgres(ql)?\b/i, 1], [/\bredis\b/i, 1],
    [/\bwebsockets?\b/i, 1], [/\bredux\b/i, 1], [/\btailwind\b/i, 1],
    [/\b(openai|llms?|gen(erative)? ?ai|genai|ai agents?|agentic|langchain|rag)\b/i, 2],
    [/\bn8n\b/i, 1], [/\bplaywright\b/i, 1], [/\baws\b/i, 1], [/\bdocker\b/i, 1],
  ],
  // [regex, penalty] matched against the job TITLE only (stacks/levels that don't fit)
  titlePenalties: [
    [/\bjava\b/i, -3], [/\.net\b|\bc#/i, -4], [/\bphp\b|\blaravel\b/i, -4], [/\bangular\b/i, -2],
    [/\bpython\b|\bdjango\b/i, -2], [/\b(salesforce|sap|wordpress|shopify)\b/i, -4],
    [/\b(lead|architect|principal|manager|head)\b/i, -3], [/\b(intern|internship|trainee|fresher)\b/i, -4],
  ],
};
// ================================================================

const ARGS = new Set(process.argv.slice(2));
const DRY_RUN = ARGS.has("--dry-run");
const OFFLINE = ARGS.has("--offline");

const OUT_DIR = path.join(__dirname, "output");
const CACHE_DIR = path.join(OUT_DIR, "cache");
const QUOTA_FILE = path.join(OUT_DIR, "quota.json");
const SEEN_FILE = path.join(OUT_DIR, "seen-jobs.json");

// Minimal .env loader (so you don't need the dotenv package)
function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (file, fallback) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback);
const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// JSearch bills 1 credit per page (measured: num_pages=10 cost 10). quota.json keeps measured costs.
function estimateCost(numPages, quota) {
  return quota.measuredCost?.[numPages] ?? numPages;
}

function buildParams(search) {
  const params = new URLSearchParams({
    query: search.query,
    page: "1",
    num_pages: String(CONFIG.numPages),
    country: CONFIG.country,
    language: CONFIG.language,
    date_posted: CONFIG.datePosted,
  });
  if (CONFIG.employmentTypes) params.set("employment_types", CONFIG.employmentTypes);
  if (search.remote) params.set("work_from_home", "true");
  return params;
}

function cacheFile(params) {
  const keyParams = new URLSearchParams(params);
  keyParams.delete("num_pages"); // a search cached with more pages can serve a smaller numPages
  const key = crypto.createHash("sha1").update(keyParams.toString()).digest("hex").slice(0, 16);
  return path.join(CACHE_DIR, `${key}.json`);
}

function readCache(params, maxAgeHours) {
  const file = cacheFile(params);
  if (!fs.existsSync(file)) return null;
  const entry = readJson(file, null);
  if (maxAgeHours !== Infinity && Date.now() - entry.fetchedAt > maxAgeHours * 3600e3) return null;
  if ((entry.numPages ?? 0) < CONFIG.numPages) return null;
  return entry.jobs;
}

async function fetchSearch(apiKey, params, quota) {
  const res = await fetch(`https://jsearch.p.rapidapi.com/search-v2?${params}`, {
    headers: { "x-rapidapi-key": apiKey, "x-rapidapi-host": "jsearch.p.rapidapi.com" },
  });

  const remaining = Number(res.headers.get("x-ratelimit-requests-remaining"));
  const limit = Number(res.headers.get("x-ratelimit-requests-limit"));
  const resetSec = Number(res.headers.get("x-ratelimit-requests-reset"));
  if (Number.isFinite(remaining) && res.headers.has("x-ratelimit-requests-remaining")) {
    if (Number.isFinite(quota.remaining) && quota.remaining > remaining) {
      // Record how much this request actually cost, so later estimates are exact
      quota.measuredCost = { ...quota.measuredCost, [CONFIG.numPages]: quota.remaining - remaining };
    }
    quota.remaining = remaining;
    if (limit) quota.limit = limit;
    if (resetSec) quota.resetsAt = new Date(Date.now() + resetSec * 1000).toISOString();
    quota.checkedAt = new Date().toISOString();
    writeJson(QUOTA_FILE, quota);
  }

  if (res.status === 403) throw new Error("403 Forbidden: check your API key and that you subscribed to JSearch on RapidAPI.");
  if (res.status === 429) throw new Error("429 Too Many Requests: rate limit or monthly quota reached.");
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

  const json = await res.json();
  if (json.status !== "OK") throw new Error(`API error: ${json.error?.message ?? JSON.stringify(json)}`);
  const jobs = json.data?.jobs ?? json.data; // search-v2 returns { data: { jobs, cursor } }
  const list = Array.isArray(jobs) ? jobs : [];
  writeJson(cacheFile(params), { query: params.get("query"), numPages: Number(params.get("num_pages")), fetchedAt: Date.now(), jobs: list });
  return list;
}

function locationOk(job) {
  if (job.job_is_remote) return true;
  // The API often gives only a state code ("DL", "UP") and puts the city in the title, e.g. "Full Stack Developer (Gurugram)"
  const fields = [job.job_location, job.job_city, job.job_state].filter(Boolean);
  if (fields.some((f) => f.split(/,\s*/).some((part) => CONFIG.allowedStateCodes.includes(part.trim())))) return true;
  const text = [...fields, job.job_title].join(" ").toLowerCase();
  return CONFIG.allowedLocations.some((loc) => text.includes(loc));
}

// First "N years" / "N-M years" / "N+ years" mention in the description (heuristic)
function experienceRequired(description) {
  const m = (description || "").match(/(\d{1,2})\s*(?:\+|-|–|to)?\s*(\d{1,2})?\s*\+?\s*(?:years?|yrs?)/i);
  if (!m) return null;
  const min = Number(m[1]);
  const max = m[2] ? Number(m[2]) : null;
  return min > 20 ? null : { min, max, text: m[0].trim() };
}

function scoreJob(job) {
  const title = job.job_title || "";
  const text = `${title}\n${job.job_description || ""}`;
  let score = 0;
  const matched = [];
  for (const [re, w] of PROFILE.skills) {
    const m = text.match(re);
    if (m) { score += w; matched.push(m[0]); }
  }
  for (const [re, p] of PROFILE.titlePenalties) if (re.test(title)) score += p;

  const exp = experienceRequired(job.job_description);
  if (exp) {
    const gap = exp.min - PROFILE.yearsExperience;
    if (gap <= 1) score += 2;         // you meet or nearly meet the minimum
    else if (gap >= 3) score -= 3;    // clearly asks for much more experience
    if (exp.max !== null && exp.max < PROFILE.yearsExperience - 1) score -= 2; // junior band
  }
  return { score, matched: [...new Set(matched.map((s) => s.toLowerCase()))], exp };
}

function toRow(job, query, seen) {
  const { score, matched, exp } = scoreJob(job);
  let salary = "";
  if (job.job_min_salary || job.job_max_salary) {
    salary = `${job.job_min_salary ?? "?"} - ${job.job_max_salary ?? "?"} ${job.job_salary_period ?? ""}`.trim();
  }
  return {
    score,
    new_since_last_run: seen.has(job.job_id) ? "" : "NEW",
    company: job.employer_name ?? "",
    job_title: job.job_title ?? "",
    location: job.job_location || [job.job_city, job.job_state].filter(Boolean).join(", "),
    remote: job.job_is_remote ? "Yes" : "No",
    experience_required: exp?.text ?? "",
    matched_skills: matched.join(", "),
    posted_at: job.job_posted_at_datetime_utc ?? "",
    salary,
    source: job.job_publisher ?? "",
    apply_link: job.job_apply_link ?? "",
    company_website: job.employer_website ?? "",
    search_query: query,
    job_id: job.job_id ?? "",
  };
}

function toCsv(rows) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))];
  return "﻿" + lines.join("\n"); // BOM so Excel shows special characters correctly
}

async function main() {
  loadEnv();
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const quota = readJson(QUOTA_FILE, {});

  // ---- Plan: which searches need a real request ----
  const plan = CONFIG.searches.map((search) => {
    const params = buildParams(search);
    const cached = readCache(params, OFFLINE ? Infinity : CONFIG.cacheHours);
    return { search, params, cached };
  });
  const toFetch = plan.filter((p) => !p.cached);
  const costEach = estimateCost(CONFIG.numPages, quota);
  const plannedCost = OFFLINE ? 0 : toFetch.length * costEach;

  console.log(`Searches: ${plan.length} (${plan.length - toFetch.length} cached, ${OFFLINE ? 0 : toFetch.length} to fetch)`);
  console.log(`Estimated cost: ${plannedCost} request(s) (${costEach} each for num_pages=${CONFIG.numPages}${quota.measuredCost?.[CONFIG.numPages] ? ", measured" : ", estimated"})`);
  console.log(quota.remaining !== undefined
    ? `Quota left (as of ${quota.checkedAt}): ${quota.remaining}/${quota.limit ?? CONFIG.monthlyLimit}${quota.resetsAt ? `, resets ${quota.resetsAt}` : ""}`
    : "Quota left: unknown until the first request (saved to output/quota.json afterwards)");

  if (DRY_RUN) {
    for (const p of plan) console.log(`  ${p.cached ? "[cache]" : "[fetch]"} ${p.search.query}`);
    return;
  }

  if (quota.remaining !== undefined && plannedCost > quota.remaining - CONFIG.reserveRequests) {
    console.error(`Aborting: this run needs ~${plannedCost} but only ${quota.remaining} left (reserve ${CONFIG.reserveRequests}).`);
    console.error("Lower numPages, remove searches, or run with --offline to reuse cached results.");
    process.exit(1);
  }

  const apiKey = process.env.RAPIDAPI_KEY;
  if (toFetch.length && !OFFLINE && !apiKey) {
    console.error("Missing RAPIDAPI_KEY. Put it in a .env file next to this script.");
    process.exit(1);
  }

  // ---- Fetch ----
  const results = [];
  for (const p of plan) {
    if (p.cached) {
      console.log(`[cache] "${p.search.query}": ${p.cached.length} jobs`);
      results.push({ query: p.search.query, jobs: p.cached });
      continue;
    }
    if (OFFLINE) { console.log(`[skip]  "${p.search.query}": not in cache`); continue; }
    if (quota.remaining !== undefined && quota.remaining - costEach < CONFIG.reserveRequests) {
      console.log(`Stopping: quota reserve reached (${quota.remaining} left).`);
      break;
    }
    try {
      const jobs = await fetchSearch(apiKey, p.params, quota);
      console.log(`[fetch] "${p.search.query}": ${jobs.length} jobs (quota left: ${quota.remaining ?? "?"})`);
      results.push({ query: p.search.query, jobs });
      const measured = quota.measuredCost?.[CONFIG.numPages];
      if (measured > costEach) {
        console.log(`Stopping: num_pages=${CONFIG.numPages} actually costs ${measured} per request (estimated ${costEach}). Check --dry-run before continuing.`);
        break;
      }
    } catch (err) {
      console.error(`[error] "${p.search.query}": ${err.message}`);
      if (/403|429/.test(err.message)) break;
    }
    await sleep(CONFIG.delayMs);
  }

  // ---- Score, filter, dedupe ----
  const seenIds = new Set(readJson(SEEN_FILE, []));
  const byId = new Map();
  let outOfArea = 0;
  for (const { query, jobs } of results) {
    for (const job of jobs) {
      const key = job.job_id || `${job.employer_name}|${job.job_title}|${job.job_city}`;
      if (byId.has(key)) continue;
      if (!locationOk(job)) { outOfArea++; continue; }
      byId.set(key, toRow(job, query, seenIds));
    }
  }

  const all = [...byId.values()].sort((a, b) => b.score - a.score || a.company.localeCompare(b.company));
  const matches = all.filter((r) => r.score >= CONFIG.minScore);
  const rejected = all.filter((r) => r.score < CONFIG.minScore);

  const stamp = new Date().toISOString().slice(0, 10);
  const matchesFile = path.join(OUT_DIR, `jobs-${stamp}.csv`);
  const rejectedFile = path.join(OUT_DIR, `jobs-${stamp}-low-match.csv`);
  fs.writeFileSync(matchesFile, toCsv(matches));
  fs.writeFileSync(rejectedFile, toCsv(rejected));
  writeJson(SEEN_FILE, [...new Set([...seenIds, ...all.map((r) => r.job_id).filter(Boolean)])]);

  const newCount = matches.filter((r) => r.new_since_last_run).length;
  console.log(`\nDone. ${matches.length} matching jobs (${newCount} new), ${rejected.length} low-match, ${outOfArea} dropped as outside Delhi NCR/remote.`);
  console.log(`Matches:   ${matchesFile}`);
  console.log(`Low match: ${rejectedFile}`);
  if (quota.remaining !== undefined) console.log(`Quota left: ${quota.remaining}/${quota.limit ?? CONFIG.monthlyLimit}`);
  // Excel workbook with every job (needs `npm install exceljs`; skipped if missing)
  try {
    const { exportExcel } = require("./export-excel");
    console.log(`Excel:     ${await exportExcel(seenIds)}`);
  } catch (err) {
    if (err.code === "MODULE_NOT_FOUND") console.log("Excel:     skipped (run `npm install exceljs` to enable)");
    else console.error(`Excel export failed: ${err.message}`);
  }
  console.log("\nTop 10:");
  for (const r of matches.slice(0, 10)) {
    console.log(`  [${r.score}] ${r.job_title} @ ${r.company} (${r.location}${r.remote === "Yes" ? ", remote" : ""}) ${r.experience_required}`);
  }
}

module.exports = { CONFIG, OUT_DIR, SEEN_FILE, buildParams, readCache, locationOk, toRow, readJson };

if (require.main === module) main();
