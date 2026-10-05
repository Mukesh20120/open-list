import { useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { Job } from '../types';
import { useAppStore } from '../store/useAppStore';
import { toast } from '../lib/ui';

interface Props {
  open: boolean;
  jobs: Job[];
  defaultName?: string;
  excludeListId?: string;
  onClose: () => void;
  onSaved?: (listId: string) => void;
}

export default function SaveToListDialog({ open, jobs, defaultName = '', excludeListId, onClose, onSaved }: Props) {
  const lists = useAppStore((s) => s.lists).filter((l) => l.id !== excludeListId);
  const createList = useAppStore((s) => s.createList);
  const addJobsToList = useAppStore((s) => s.addJobsToList);
  const [target, setTarget] = useState<string>('new');
  const [name, setName] = useState(defaultName);

  const save = () => {
    if (target === 'new') {
      const listName = name.trim() || `Jobs ${new Date().toLocaleDateString()}`;
      const id = createList(listName, jobs.map((j) => ({ ...j })));
      toast(`Saved ${jobs.length} job${jobs.length === 1 ? '' : 's'} to "${listName}"`);
      onSaved?.(id);
    } else {
      const added = addJobsToList(target, jobs);
      const list = lists.find((l) => l.id === target);
      const skipped = jobs.length - added;
      toast(`Added ${added} job${added === 1 ? '' : 's'} to "${list?.name}"${skipped ? ` (${skipped} already there)` : ''}`);
      onSaved?.(target);
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      slotProps={{
        transition: {
          onEnter: () => {
            setTarget('new');
            setName(defaultName);
          },
        },
      }}
    >
      <DialogTitle>Save {jobs.length} job{jobs.length === 1 ? '' : 's'} to a list</DialogTitle>
      <DialogContent>
        <RadioGroup value={target} onChange={(e) => setTarget(e.target.value)}>
          <FormControlLabel value="new" control={<Radio />} label="New list" />
          {target === 'new' && (
            <TextField
              autoFocus
              size="small"
              label="List name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              className="mb-2 ml-8"
            />
          )}
          {lists.length > 0 && (
            <Typography variant="overline" color="text.secondary" className="mt-2">
              Existing lists
            </Typography>
          )}
          <div className="max-h-64 overflow-y-auto">
            {lists.map((l) => (
              <FormControlLabel
                key={l.id}
                value={l.id}
                control={<Radio />}
                label={
                  <span>
                    {l.name}{' '}
                    <Typography component="span" variant="caption" color="text.secondary">
                      · {l.jobs.length} jobs
                    </Typography>
                  </span>
                }
                className="w-full"
              />
            ))}
          </div>
        </RadioGroup>
      </DialogContent>
      <DialogActions className="px-6 pb-4">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={!jobs.length}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
