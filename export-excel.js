// export-excel.js
// Builds an Excel workbook of every job in the cached search results. Makes NO API requests.
// Run:  node export-excel.js      (fetch-jobs.js also runs this automatically after each fetch)
// Needs: npm install exceljs

const path = require("path");
const ExcelJS = require("exceljs");
const { CONFIG, OUT_DIR, SEEN_FILE, buildParams, readCache, locationOk, toRow, readJson } = require("./fetch-jobs");

const COLUMNS = [
  { header: "Score", key: "score", width: 8 },
  { header: "New", key: "new_since_last_run", width: 7 },
  { header: "Status", key: "status", width: 18 },
  { header: "Company", key: "company", width: 28 },
  { header: "Job Title", key: "job_title", width: 45 },
  { header: "Location", key: "location", width: 22 },
  { header: "Remote", key: "remote", width: 9 },
  { header: "Experience", key: "experience_required", width: 14 },
  { header: "Matched Skills", key: "matched_skills", width: 40 },
  { header: "Posted", key: "posted_at", width: 12 },
  { header: "Salary", key: "salary", width: 16 },
  { header: "Source", key: "source", width: 14 },
  { header: "Apply Link", key: "apply_link", width: 14 },
  { header: "Company Website", key: "company_website", width: 16 },
  { header: "Search", key: "search_query", width: 30 },
  { header: "Job ID", key: "job_id", width: 14 },
];

function styleHeader(sheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
  header.alignment = { vertical: "middle" };
  header.height = 22;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
}

function scoreFill(score) {
  if (score >= 15) return "FFC6EFCE"; // green
  if (score >= 8) return "FFFFEB9C";  // yellow
  if (score >= CONFIG.minScore) return "FFFCE4D6"; // light orange
  return "FFF2F2F2"; // grey
}

function link(url, text) {
  return url ? { text, hyperlink: url } : "";
}

function addJobSheet(workbook, name, rows, { withDescription = false } = {}) {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = withDescription ? [...COLUMNS, { header: "Description", key: "description", width: 80 }] : COLUMNS;
  for (const r of rows) {
    const row = sheet.addRow({
      ...r,
      posted_at: r.posted_at ? new Date(r.posted_at) : "",
      apply_link: link(r.apply_link, "Apply"),
      company_website: link(r.company_website, "Website"),
    });
    row.getCell("score").fill = { type: "pattern", pattern: "solid", fgColor: { argb: scoreFill(r.score) } };
    row.getCell("posted_at").numFmt = "dd-mmm-yyyy";
    for (const key of ["apply_link", "company_website"]) {
      if (r[key]) row.getCell(key).font = { color: { argb: "FF0563C1" }, underline: true };
    }
    if (r.new_since_last_run) row.getCell("new_since_last_run").font = { bold: true, color: { argb: "FF00B050" } };
  }
  styleHeader(sheet);
  return sheet;
}

function addCompanySheet(workbook, rows) {
  const companies = new Map();
  for (const r of rows) {
    const name = r.company || "(unknown)";
    if (!companies.has(name)) companies.set(name, { company: name, openings: 0, best: -Infinity, titles: new Set(), locations: new Set(), website: "", apply: "" });
    const c = companies.get(name);
    c.openings++;
    c.titles.add(r.job_title);
    c.locations.add(r.remote === "Yes" ? "Remote" : r.location);
    c.website ||= r.company_website;
    if (r.score > c.best) { c.best = r.score; c.apply = r.apply_link; }
  }

  const sheet = workbook.addWorksheet("Companies");
  sheet.columns = [
    { header: "Company", key: "company", width: 30 },
    { header: "Openings", key: "openings", width: 10 },
    { header: "Best Score", key: "best", width: 11 },
    { header: "Locations", key: "locations", width: 30 },
    { header: "Job Titles", key: "titles", width: 70 },
    { header: "Best Job Apply Link", key: "apply", width: 18 },
    { header: "Website", key: "website", width: 16 },
  ];
  const sorted = [...companies.values()].sort((a, b) => b.best - a.best || b.openings - a.openings);
  for (const c of sorted) {
    const row = sheet.addRow({
      ...c,
      titles: [...c.titles].join(" | "),
      locations: [...c.locations].join(", "),
      apply: link(c.apply, "Apply"),
      website: link(c.website, "Website"),
    });
    row.getCell("best").fill = { type: "pattern", pattern: "solid", fgColor: { argb: scoreFill(c.best) } };
    for (const key of ["apply", "website"]) if (c[key]) row.getCell(key).font = { color: { argb: "FF0563C1" }, underline: true };
  }
  styleHeader(sheet);
}

async function exportExcel(seenIds = new Set(readJson(SEEN_FILE, []))) {
  // Every job from the configured searches, using cached responses of any age
  const byId = new Map();
  for (const search of CONFIG.searches) {
    const jobs = readCache(buildParams(search), Infinity) ?? [];
    for (const job of jobs) {
      const key = job.job_id || `${job.employer_name}|${job.job_title}|${job.job_city}`;
      if (byId.has(key)) continue;
      const row = toRow(job, search.query, seenIds);
      row.status = !locationOk(job) ? "Outside Delhi NCR" : row.score >= CONFIG.minScore ? "Match" : "Low match";
      row.description = (job.job_description || "").slice(0, 32000); // Excel cell limit is 32,767 chars
      byId.set(key, row);
    }
  }

  const all = [...byId.values()].sort((a, b) => b.score - a.score || a.company.localeCompare(b.company));
  const matches = all.filter((r) => r.status === "Match");
  const inArea = all.filter((r) => r.status !== "Outside Delhi NCR");

  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  addJobSheet(workbook, `Best Matches (${matches.length})`, matches);
  addJobSheet(workbook, `All Jobs (${all.length})`, all, { withDescription: true });
  addCompanySheet(workbook, inArea);

  const file = path.join(OUT_DIR, `jobs-${new Date().toISOString().slice(0, 10)}.xlsx`);
  await workbook.xlsx.writeFile(file);
  return file;
}

module.exports = { exportExcel };

if (require.main === module) {
  exportExcel().then((file) => console.log(`Excel: ${file}`)).catch((err) => { console.error(err); process.exit(1); });
}
