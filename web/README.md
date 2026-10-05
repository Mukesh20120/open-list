# Open List (web)

Browser version of `../fetch-jobs.js`: search jobs through the JSearch API (RapidAPI), score them against your skill profile, save them to lists, and download or import those lists. Everything stays in your browser; there is no backend.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

## Features

- **API key**: entered in the app and stored only in this browser (IndexedDB). It is sent only to `jsearch.p.rapidapi.com`.
- **Quota**: RapidAPI no longer sends quota headers, so the app counts usage itself (1 request per 10 jobs) and resets the count on your plan's monthly reset day. Click the "requests left" counter to set your plan limit and reset day, or enter the exact "used" number from the RapidAPI dashboard. The app blocks any search that would go over the limit.
- **Search**: query, date posted, number of results (each 10 results cost 1 request), and a remote-only option. "Add to current results" merges several searches into one result set, with duplicates removed. Jobs not seen in earlier searches get a NEW tag.
- **Scoring**: same rules as the CLI. Skill keywords add points, title penalties subtract them, and experience fit adjusts the score. You can edit all of it in Settings → Match profile; saving rescores everything.
- **Browse and filter**: table view (sort, resize, hide columns) or card view. Filter by text, remote/on-site, posted date, source, status, good matches only, new only, and has salary. Click a job to open its details: description with matched skills highlighted, apply link, and previous/next buttons.
- **Lists**: save selected or filtered jobs to a new or existing list. Set a status on each job (Interested → Applied → Interview → Offer / Rejected) and add notes. You can rename or delete lists, and copy jobs between them.
- **Download**: JSON (full data, can be re-imported), CSV, or Excel (styled, with a Companies sheet). Downloads cover the selected jobs, the filtered jobs, or the whole list. The backup button saves all lists to one JSON file.
- **Import**: click the import button or drag files onto the Lists page. Accepts this app's JSON/CSV exports and backups, plus the CLI's `output/jobs-*.csv` files and raw `output/cache/*.json` API responses.

## Stack

React 19 + Vite + TypeScript, MUI 9 (+ MUI X DataGrid), Tailwind CSS 4, Zustand (persisted to IndexedDB via `idb-keyval`), ExcelJS (loaded only when you export to Excel).

| Path | What |
| --- | --- |
| `src/store/useAppStore.ts` | Zustand store: key, settings, results, lists, quota |
| `src/lib/jsearch.ts` | API client and job normalisation |
| `src/lib/scoring.ts` | Match scoring (ported from `fetch-jobs.js`) |
| `src/lib/files.ts` | JSON / CSV / Excel export and import |
| `src/lib/filters.ts` | Filter logic |
| `src/components/JobBrowser.tsx` | Filters, stats, table/cards, bulk actions, export, drawer |
| `src/pages/` | Search and Lists pages |
