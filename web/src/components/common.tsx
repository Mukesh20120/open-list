import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Snackbar from '@mui/material/Snackbar';
import Tooltip from '@mui/material/Tooltip';
import type { JobStatus } from '../types';
import { STATUS_META, useToast } from '../lib/ui';
import { useAppStore } from '../store/useAppStore';

export function Toaster() {
  const { toast: t, close } = useToast();
  return (
    <Snackbar
      key={t?.id}
      open={Boolean(t)}
      autoHideDuration={t?.severity === 'error' ? 8000 : 3500}
      onClose={(_, reason) => reason !== 'clickaway' && close()}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert onClose={close} severity={t?.severity ?? 'info'} variant="filled" className="shadow-lg">
        {t?.message}
      </Alert>
    </Snackbar>
  );
}

// ---------- job display helpers ----------

export function StatusChip({ status }: { status: JobStatus }) {
  const m = STATUS_META[status] ?? STATUS_META.none;
  return <Chip size="small" label={m.label} color={m.color} variant={status === 'none' ? 'outlined' : 'filled'} />;
}

export function ScoreChip({ score, size = 'small' }: { score: number; size?: 'small' | 'medium' }) {
  const minScore = useAppStore((s) => s.settings.minScore);
  const color = score >= 15 ? 'success' : score >= 8 ? 'warning' : score >= minScore ? 'info' : 'default';
  return (
    <Tooltip title={score >= minScore ? 'Profile match score' : `Below your minimum score (${minScore})`}>
      <Chip size={size} label={score} color={color} className="min-w-10 font-bold tabular-nums" />
    </Tooltip>
  );
}

const AVATAR_COLORS = ['#4f46e5', '#0d9488', '#db2777', '#ea580c', '#2563eb', '#7c3aed', '#059669', '#ca8a04', '#dc2626', '#0891b2'];
const avatarColor = (name: string) => AVATAR_COLORS[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AVATAR_COLORS.length];

export function CompanyAvatar({ name, logo, size = 28 }: { name: string; logo?: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  return (
    <Avatar
      variant="rounded"
      src={logo && !broken ? logo : undefined}
      slotProps={{ img: { onError: () => setBroken(true), referrerPolicy: 'no-referrer' } }}
      sx={{ width: size, height: size, fontSize: size * 0.45, bgcolor: avatarColor(name || '?'), color: '#fff' }}
    >
      {(name || '?').trim().charAt(0).toUpperCase()}
    </Avatar>
  );
}
