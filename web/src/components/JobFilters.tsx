import Badge from '@mui/material/Badge';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputAdornment from '@mui/material/InputAdornment';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import SearchIcon from '@mui/icons-material/Search';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import type { JobStatus } from '../types';
import { EMPTY_FILTERS, activeFilterCount, type Filters } from '../lib/filters';
import { STATUSES, STATUS_META } from '../lib/ui';

interface Props {
  value: Filters;
  onChange: (f: Filters) => void;
  sources: string[];
  showStatus: boolean;
  showNew: boolean;
  minScore: number;
}

export default function JobFilters({ value: f, onChange, sources, showStatus, showNew, minScore }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...f, ...patch });
  const count = activeFilterCount(f);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <TextField
          size="small"
          placeholder="Filter by title, company, skill, keyword…"
          value={f.text}
          onChange={(e) => set({ text: e.target.value })}
          className="min-w-[220px] flex-1"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <TextField select size="small" label="Work type" value={f.remote} onChange={(e) => set({ remote: e.target.value as Filters['remote'] })} className="w-36">
          <MenuItem value="any">Any</MenuItem>
          <MenuItem value="remote">Remote</MenuItem>
          <MenuItem value="onsite">On-site</MenuItem>
        </TextField>
        <TextField select size="small" label="Posted" value={f.postedWithin} onChange={(e) => set({ postedWithin: Number(e.target.value) })} className="w-36">
          <MenuItem value={0}>Any time</MenuItem>
          <MenuItem value={1}>Last 24 hours</MenuItem>
          <MenuItem value={3}>Last 3 days</MenuItem>
          <MenuItem value={7}>Last 7 days</MenuItem>
          <MenuItem value={14}>Last 14 days</MenuItem>
          <MenuItem value={30}>Last 30 days</MenuItem>
        </TextField>
        {sources.length > 1 && (
          <TextField
            select
            size="small"
            label="Source"
            className="w-40"
            value={f.sources}
            onChange={(e) => set({ sources: e.target.value as unknown as string[] })}
            slotProps={{ select: { multiple: true, renderValue: (v) => ((v as string[]).length ? (v as string[]).join(', ') : 'All') } }}
          >
            {sources.map((s) => (
              <MenuItem key={s} value={s} dense>
                <Checkbox size="small" checked={f.sources.includes(s)} />
                <ListItemText primary={s} />
              </MenuItem>
            ))}
          </TextField>
        )}
        {showStatus && (
          <TextField
            select
            size="small"
            label="Status"
            className="w-40"
            value={f.statuses}
            onChange={(e) => set({ statuses: e.target.value as unknown as JobStatus[] })}
            slotProps={{
              select: {
                multiple: true,
                renderValue: (v) => ((v as JobStatus[]).length ? (v as JobStatus[]).map((s) => STATUS_META[s].label).join(', ') : 'All'),
              },
            }}
          >
            {STATUSES.map((s) => (
              <MenuItem key={s} value={s} dense>
                <Checkbox size="small" checked={f.statuses.includes(s)} />
                <ListItemText primary={STATUS_META[s].label} />
              </MenuItem>
            ))}
          </TextField>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <FormControlLabel
          control={<Switch size="small" checked={f.goodOnly} onChange={(e) => set({ goodOnly: e.target.checked })} />}
          label={<span className="text-sm">Good matches only (score ≥ {minScore})</span>}
        />
        {showNew && (
          <FormControlLabel
            control={<Switch size="small" checked={f.newOnly} onChange={(e) => set({ newOnly: e.target.checked })} />}
            label={<span className="text-sm">New since last search</span>}
          />
        )}
        <FormControlLabel
          control={<Switch size="small" checked={f.hasSalary} onChange={(e) => set({ hasSalary: e.target.checked })} />}
          label={<span className="text-sm">Has salary</span>}
        />
        <div className="flex-1" />
        <Badge badgeContent={count} color="primary">
          <Button size="small" color="inherit" startIcon={<FilterAltOffIcon />} disabled={!count} onClick={() => onChange(EMPTY_FILTERS)}>
            Clear filters
          </Button>
        </Badge>
      </div>
    </div>
  );
}
