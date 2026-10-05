import { useState } from 'react';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import type { DatePosted, Settings, WeightedKeyword } from '../types';
import { DATE_OPTIONS, EMPLOYMENT_TYPES } from '../lib/ui';
import { DEFAULT_SETTINGS, useAppStore } from '../store/useAppStore';
import { toast } from '../lib/ui';

function KeywordTable({
  title,
  hint,
  rows,
  onChange,
}: {
  title: string;
  hint: string;
  rows: WeightedKeyword[];
  onChange: (rows: WeightedKeyword[]) => void;
}) {
  const update = (i: number, patch: Partial<WeightedKeyword>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div>
          <Typography variant="subtitle2">{title}</Typography>
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        </div>
        <Button size="small" startIcon={<AddIcon />} onClick={() => onChange([...rows, { keyword: '', weight: 1 }])}>
          Add
        </Button>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <TextField
            size="small"
            fullWidth
            placeholder="react|reactjs|react.js"
            value={r.keyword}
            onChange={(e) => update(i, { keyword: e.target.value })}
          />
          <TextField
            size="small"
            type="number"
            label="Weight"
            className="w-24 shrink-0"
            value={r.weight}
            onChange={(e) => update(i, { weight: Number(e.target.value) })}
            slotProps={{ htmlInput: { min: 0, max: 10 } }}
          />
          <IconButton size="small" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="Remove keyword">
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </div>
      ))}
    </div>
  );
}

export default function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const [draft, setDraft] = useState<Settings>(settings);
  const [tab, setTab] = useState(0);
  const set = (patch: Partial<Settings>) => setDraft((d) => ({ ...d, ...patch }));

  const save = () => {
    updateSettings({
      ...draft,
      skills: draft.skills.filter((s) => s.keyword.trim()),
      titlePenalties: draft.titlePenalties.filter((s) => s.keyword.trim()),
    });
    toast('Settings saved. Scores were recalculated.');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      slotProps={{ transition: { onEnter: () => setDraft(settings) } }}
    >
      <DialogTitle>Settings</DialogTitle>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} className="px-6" sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Search defaults" />
        <Tab label="Match profile" />
      </Tabs>
      <DialogContent className="min-h-[420px]">
        {tab === 0 && (
          <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
            <TextField
              label="Country code"
              helperText="ISO code, e.g. in, us, gb"
              value={draft.country}
              onChange={(e) => set({ country: e.target.value.toLowerCase().slice(0, 2) })}
            />
            <TextField
              label="Language"
              helperText="e.g. en"
              value={draft.language}
              onChange={(e) => set({ language: e.target.value.toLowerCase().slice(0, 2) })}
            />
            <FormControl>
              <InputLabel>Date posted</InputLabel>
              <Select label="Date posted" value={draft.datePosted} onChange={(e) => set({ datePosted: e.target.value as DatePosted })}>
                {DATE_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl>
              <InputLabel>Employment types</InputLabel>
              <Select
                multiple
                label="Employment types"
                value={draft.employmentTypes}
                onChange={(e) => set({ employmentTypes: e.target.value as string[] })}
                renderValue={(v) =>
                  v.length ? v.map((x) => EMPLOYMENT_TYPES.find((t) => t.value === x)?.label ?? x).join(', ') : 'Any'
                }
                displayEmpty
              >
                {EMPLOYMENT_TYPES.map((t) => (
                  <MenuItem key={t.value} value={t.value}>
                    <Checkbox size="small" checked={draft.employmentTypes.includes(t.value)} />
                    <ListItemText primary={t.label} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Pages per search"
              type="number"
              helperText="10 jobs per page. Each page costs 1 API request."
              value={draft.numPages}
              onChange={(e) => set({ numPages: Math.min(20, Math.max(1, Number(e.target.value) || 1)) })}
              slotProps={{ htmlInput: { min: 1, max: 20 } }}
            />
          </div>
        )}
        {tab === 1 && (
          <div className="flex flex-col gap-6 pt-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label="Your years of experience"
                type="number"
                value={draft.yearsExperience}
                onChange={(e) => set({ yearsExperience: Number(e.target.value) || 0 })}
                helperText="Jobs asking for much more (or much less) experience lose points"
              />
              <TextField
                label="Minimum match score"
                type="number"
                value={draft.minScore}
                onChange={(e) => set({ minScore: Number(e.target.value) || 0 })}
                helperText='Used by the "Good matches only" filter'
              />
            </div>
            <KeywordTable
              title="Skills (title + description)"
              hint="Each matching keyword adds its weight. Use | for alternatives."
              rows={draft.skills}
              onChange={(skills) => set({ skills })}
            />
            <KeywordTable
              title="Title penalties"
              hint="Subtracts the weight when the job title matches (stacks or levels that don't fit)."
              rows={draft.titlePenalties}
              onChange={(titlePenalties) => set({ titlePenalties })}
            />
          </div>
        )}
      </DialogContent>
      <DialogActions className="px-6 pb-4">
        <Button color="inherit" className="mr-auto" onClick={() => setDraft(DEFAULT_SETTINGS)}>
          Reset to defaults
        </Button>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
