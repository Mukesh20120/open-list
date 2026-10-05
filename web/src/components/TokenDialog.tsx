import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Link from '@mui/material/Link';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import KeyIcon from '@mui/icons-material/Key';
import { useAppStore } from '../store/useAppStore';
import { toast } from '../lib/ui';

export default function TokenDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const apiKey = useAppStore((s) => s.apiKey);
  const setApiKey = useAppStore((s) => s.setApiKey);
  const [value, setValue] = useState(apiKey);
  const [show, setShow] = useState(false);

  const save = () => {
    setApiKey(value);
    toast(value.trim() ? 'API key saved in this browser' : 'API key removed', 'success');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      slotProps={{ transition: { onEnter: () => setValue(apiKey) } }}
    >
      <DialogTitle className="flex items-center gap-2">
        <KeyIcon color="primary" /> RapidAPI key
      </DialogTitle>
      <DialogContent className="flex flex-col gap-4">
        <Typography variant="body2" color="text.secondary">
          Searches use the{' '}
          <Link href="https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch" target="_blank" rel="noreferrer">
            JSearch API on RapidAPI
          </Link>
          . Subscribe (the free plan includes 200 requests/month), then paste your <code>X-RapidAPI-Key</code> here.
        </Typography>
        <TextField
          autoFocus
          fullWidth
          label="X-RapidAPI-Key"
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          autoComplete="off"
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShow((s) => !s)} edge="end" aria-label={show ? 'Hide key' : 'Show key'}>
                    {show ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
        <Alert severity="info" variant="outlined">
          The key is stored only in this browser (IndexedDB) and sent only to jsearch.p.rapidapi.com.
        </Alert>
      </DialogContent>
      <DialogActions className="px-6 pb-4">
        {apiKey && (
          <Button color="error" onClick={() => setValue('')} className="mr-auto">
            Clear
          </Button>
        )}
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
