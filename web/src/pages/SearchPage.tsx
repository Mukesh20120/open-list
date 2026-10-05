import { useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import SearchIcon from '@mui/icons-material/Search';
import HistoryIcon from '@mui/icons-material/History';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import WorkOutlineIcon from '@mui/icons-material/WorkOutlined';
import type { DatePosted } from '../types';
import { useAppStore } from '../store/useAppStore';
import { searchJobs } from '../lib/jsearch';
import { usageView } from '../lib/quota';
import JobBrowser from '../components/JobBrowser';
import { DATE_OPTIONS, formatDate, toast } from '../lib/ui';

const EXAMPLES = ['full stack developer in Noida', 'react developer in Gurugram', 'remote node.js developer India', 'AI engineer in Delhi'];

export default function SearchPage({ onOpenToken, onOpenQuota }: { onOpenToken: () => void; onOpenQuota: () => void }) {
  const apiKey = useAppStore((s) => s.apiKey);
  const settings = useAppStore((s) => s.settings);
  const usage = useAppStore((s) => s.usage);
  const results = useAppStore((s) => s.results);
  const recentQueries = useAppStore((s) => s.recentQueries);
  const addResults = useAppStore((s) => s.addResults);
  const recordUsage = useAppStore((s) => s.recordUsage);
  const clearResults = useAppStore((s) => s.clearResults);

  const [query, setQuery] = useState('');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [datePosted, setDatePosted] = useState<DatePosted>(settings.datePosted);
  const [numPages, setNumPages] = useState(settings.numPages);
  const [append, setAppend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const quota = usageView(usage, settings);
  const notEnoughQuota = Boolean(apiKey) && quota.remaining < numPages;

  const run = async (q = query) => {
    const text = q.trim();
    if (!text) return;
    if (!apiKey) return onOpenToken();
    setQuery(text);
    setError('');
    setLoading(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const jobs = await searchJobs(
        apiKey,
        {
          query: text,
          remoteOnly,
          datePosted,
          numPages,
          employmentTypes: settings.employmentTypes,
          country: settings.country,
          language: settings.language,
        },
        settings,
        ctrl.signal,
        recordUsage,
      );
      addResults(jobs, text, append && results.jobs.length > 0);
      toast(`Found ${jobs.length} jobs for "${text}"`, jobs.length ? 'success' : 'info');
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError((err as Error).message);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const listName = results.queries.length === 1 ? results.queries[0] : `Search results (${results.queries.length} searches)`;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <Paper variant="outlined" className="p-4 sm:p-5">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <div className="flex flex-col gap-3 md:flex-row">
            <TextField
              fullWidth
              autoFocus
              placeholder='Job title and place, e.g. "full stack developer in Noida"'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                },
              }}
            />
            {loading ? (
              <Button size="large" variant="outlined" color="inherit" onClick={() => abortRef.current?.abort()} className="shrink-0 px-8" startIcon={<CircularProgress size={18} />}>
                Cancel
              </Button>
            ) : (
              <Button type="submit" size="large" variant="contained" className="shrink-0 px-8" disabled={!query.trim() || notEnoughQuota}>
                Search
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <TextField select size="small" label="Date posted" value={datePosted} onChange={(e) => setDatePosted(e.target.value as DatePosted)} className="w-40">
              {DATE_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField select size="small" label="Results" value={numPages} onChange={(e) => setNumPages(Number(e.target.value))} className="w-64">
              {[1, 2, 3, 5, 10].map((n) => (
                <MenuItem key={n} value={n}>
                  ~{n * 10} jobs · costs {n} request{n > 1 ? 's' : ''}
                </MenuItem>
              ))}
            </TextField>
            <FormControlLabel control={<Switch checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} />} label="Remote only" />
            <FormControlLabel
              control={<Switch checked={append} onChange={(e) => setAppend(e.target.checked)} disabled={!results.jobs.length} />}
              label="Add to current results"
            />
            {apiKey && (
              <Link component="button" type="button" variant="body2" color="text.secondary" onClick={onOpenQuota} className="sm:ml-auto">
                {quota.exact ? '' : '~'}
                {quota.remaining} of {quota.limit} requests left · after this search: {Math.max(0, quota.remaining - numPages)}
              </Link>
            )}
          </div>

          {recentQueries.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <HistoryIcon fontSize="small" className="opacity-50" />
              {recentQueries.map((q) => (
                <Chip key={q} label={q} size="small" variant="outlined" onClick={() => setQuery(q)} disabled={loading} />
              ))}
            </div>
          )}
        </form>

        {!apiKey && (
          <Alert
            severity="warning"
            className="mt-4"
            action={
              <Button color="inherit" size="small" onClick={onOpenToken}>
                Add key
              </Button>
            }
          >
            Add your RapidAPI key to start searching. You can still import and browse saved lists without one.
          </Alert>
        )}
        {notEnoughQuota && (
          <Alert severity="warning" className="mt-4">
            {quota.remaining
              ? `Only ${quota.remaining} API request(s) left this month; this search needs ${numPages}. Choose fewer results.`
              : `No API requests left this month (resets ${formatDate(quota.resetsAt.toISOString())}).`}{' '}
            If that's wrong,{' '}
            <Link component="button" type="button" onClick={onOpenQuota} className="align-baseline">
              sync the count
            </Link>
            .
          </Alert>
        )}
        {error && (
          <Alert severity="error" className="mt-4" onClose={() => setError('')}>
            {error}
          </Alert>
        )}
      </Paper>

      {results.jobs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Typography variant="body2" color="text.secondary">
            Results from
          </Typography>
          {results.queries.map((q) => (
            <Chip key={q} label={q} size="small" />
          ))}
          {results.at && (
            <Typography variant="caption" color="text.secondary">
              · {formatDate(results.at)}
            </Typography>
          )}
          <div className="flex-1" />
          <Button size="small" color="inherit" startIcon={<ClearAllIcon />} onClick={clearResults}>
            Clear results
          </Button>
        </div>
      )}

      <JobBrowser
        key={results.at ?? 'empty'}
        jobs={results.jobs}
        listId={null}
        listName={listName}
        newIds={results.newIds}
        empty={
          <Paper variant="outlined" className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <WorkOutlineIcon sx={{ fontSize: 56 }} color="primary" className="opacity-70" />
            <Typography variant="h6">Search for jobs</Typography>
            <Typography color="text.secondary" className="max-w-md">
              Results are scored against your skill profile (edit it in Settings). Save the good ones to lists, track your
              applications, and download them as JSON, CSV or Excel.
            </Typography>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {EXAMPLES.map((q) => (
                <Chip key={q} label={q} variant="outlined" color="primary" onClick={() => setQuery(q)} />
              ))}
            </div>
          </Paper>
        }
      />
    </div>
  );
}
