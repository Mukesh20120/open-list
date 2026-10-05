import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import LinearProgress from '@mui/material/LinearProgress';
import Link from '@mui/material/Link';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useAppStore } from '../store/useAppStore';
import { RAPIDAPI_USAGE_URL, usageView } from '../lib/quota';
import { formatDate, toast } from '../lib/ui';

export default function QuotaDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useAppStore((s) => s.settings);
  const usage = useAppStore((s) => s.usage);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const setUsed = useAppStore((s) => s.setUsed);
  const view = usageView(usage, settings);

  const [limit, setLimit] = useState(String(view.limit));
  const [resetDay, setResetDay] = useState(String(settings.resetDay));
  const [used, setUsedDraft] = useState(String(view.used));

  const reset = () => {
    setLimit(String(view.limit));
    setResetDay(String(settings.resetDay));
    setUsedDraft(String(view.used));
  };

  const save = () => {
    const nextLimit = Math.max(1, Math.round(Number(limit)) || settings.monthlyLimit);
    const nextDay = Math.min(31, Math.max(1, Math.round(Number(resetDay)) || settings.resetDay));
    if (nextLimit !== settings.monthlyLimit || nextDay !== settings.resetDay) {
      updateSettings({ ...settings, monthlyLimit: nextLimit, resetDay: nextDay });
    }
    const nextUsed = Math.max(0, Math.round(Number(used)) || 0);
    // Changing the reset day moves the cycle, so always store the count against the new cycle
    if (nextUsed !== view.used || nextDay !== settings.resetDay) setUsed(nextUsed);
    toast('Quota updated');
    onClose();
  };

  const pct = Math.min(100, (view.used / view.limit) * 100);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" slotProps={{ transition: { onEnter: reset } }}>
      <DialogTitle>API requests this month</DialogTitle>
      <DialogContent className="flex flex-col gap-4">
        <div>
          <div className="flex items-baseline justify-between">
            <Typography variant="h4" className="font-semibold tabular-nums">
              {view.remaining}
              <Typography component="span" color="text.secondary" className="ml-1">
                / {view.limit} left
              </Typography>
            </Typography>
            <Typography variant="caption" color="text.secondary">
              resets {formatDate(view.resetsAt.toISOString())}
            </Typography>
          </div>
          <LinearProgress
            variant="determinate"
            value={pct}
            color={pct > 85 ? 'error' : pct > 60 ? 'warning' : 'primary'}
            className="mt-2 h-2 rounded"
          />
          <Typography variant="caption" color="text.secondary" className="mt-1 block">
            {view.used} used ·{' '}
            {view.syncedAt ? `counted since you synced on ${formatDate(view.syncedAt)}` : 'counted by this app (estimate)'}
          </Typography>
        </div>

        <Alert severity="info" variant="outlined">
          RapidAPI doesn't report the remaining quota to the browser, so this app counts it: each 10 jobs fetched costs 1
          request. Searches from other devices or the CLI aren't counted. Check the exact number on{' '}
          <Link href={RAPIDAPI_USAGE_URL} target="_blank" rel="noreferrer">
            your RapidAPI dashboard
          </Link>{' '}
          and enter it below.
        </Alert>

        <TextField
          label="Requests used so far"
          type="number"
          value={used}
          onChange={(e) => setUsedDraft(e.target.value)}
          helperText="Copy from the RapidAPI dashboard to sync"
          slotProps={{ htmlInput: { min: 0 } }}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Monthly limit"
            type="number"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            helperText="Free plan: 200"
            slotProps={{ htmlInput: { min: 1 } }}
          />
          <TextField
            label="Resets on day"
            type="number"
            value={resetDay}
            onChange={(e) => setResetDay(e.target.value)}
            helperText="Day you subscribed"
            slotProps={{ htmlInput: { min: 1, max: 31 } }}
          />
        </div>
      </DialogContent>
      <DialogActions className="px-6 pb-4">
        <Button href={RAPIDAPI_USAGE_URL} target="_blank" rel="noreferrer" endIcon={<OpenInNewIcon />} className="mr-auto">
          Dashboard
        </Button>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
