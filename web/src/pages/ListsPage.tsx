import { useRef, useState, type DragEvent } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import BackupIcon from '@mui/icons-material/Backup';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import BookmarksIcon from '@mui/icons-material/BookmarksOutlined';
import { useAppStore } from '../store/useAppStore';
import { downloadBackup, importFile } from '../lib/files';
import JobBrowser from '../components/JobBrowser';
import { formatDate, timeAgo, toast } from '../lib/ui';

export default function ListsPage() {
  const lists = useAppStore((s) => s.lists);
  const settings = useAppStore((s) => s.settings);
  const importLists = useAppStore((s) => s.importLists);
  const renameList = useAppStore((s) => s.renameList);
  const deleteList = useAppStore((s) => s.deleteList);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = lists.find((l) => l.id === selectedId) ?? lists[0] ?? null;

  const handleFiles = async (files: FileList | File[] | null) => {
    if (!files?.length) return;
    let firstId: string | null = null;
    for (const file of Array.from(files)) {
      try {
        const imported = await importFile(file, settings);
        importLists(imported);
        firstId ??= useAppStore.getState().lists[0]?.id ?? null;
        const count = imported.reduce((n, l) => n + l.jobs.length, 0);
        toast(`Imported ${imported.length} list(s), ${count} jobs from ${file.name}`);
      } catch (err) {
        toast(`Could not import ${file.name}: ${(err as Error).message}`, 'error');
      }
    }
    if (firstId) setSelectedId(firstId);
    if (fileRef.current) fileRef.current.value = '';
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const saveRename = () => {
    if (renaming && newName.trim()) renameList(renaming, newName.trim());
    setRenaming(null);
  };

  return (
    <div
      className="relative flex flex-1 flex-col gap-4 lg:flex-row"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={onDrop}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-indigo-500 bg-indigo-500/10">
          <Typography variant="h6" color="primary">
            Drop JSON or CSV files to import
          </Typography>
        </div>
      )}

      <input ref={fileRef} type="file" accept=".json,.csv,application/json,text/csv" multiple hidden onChange={(e) => handleFiles(e.target.files)} />

      <Paper variant="outlined" className="flex shrink-0 flex-col lg:w-72">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <Typography variant="subtitle1" className="font-semibold">
            Saved lists
          </Typography>
          <Tooltip title="Back up all lists to one JSON file">
            <span>
              <IconButton size="small" onClick={() => downloadBackup(lists)} disabled={!lists.length}>
                <BackupIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </div>
        <div className="px-3 pb-2">
          <Button fullWidth variant="outlined" startIcon={<UploadFileIcon />} onClick={() => fileRef.current?.click()}>
            Import JSON / CSV
          </Button>
        </div>
        <List dense className="max-h-60 overflow-y-auto lg:max-h-none lg:flex-1">
          {lists.map((l) => (
            <ListItemButton key={l.id} selected={l.id === selected?.id} onClick={() => setSelectedId(l.id)} className="mx-2 rounded-lg">
              <ListItemText
                primary={l.name}
                secondary={`${l.jobs.length} jobs · ${timeAgo(l.updatedAt)}`}
                slotProps={{ primary: { noWrap: true, className: 'font-medium' } }}
              />
            </ListItemButton>
          ))}
        </List>
        {!lists.length && (
          <Typography variant="body2" color="text.secondary" className="px-4 pb-4">
            No lists yet. Save jobs from a search, or import a file you downloaded earlier.
          </Typography>
        )}
      </Paper>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {selected ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1">
                <Typography variant="h5" className="truncate font-semibold">
                  {selected.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {selected.jobs.length} jobs · created {formatDate(selected.createdAt)} · updated {timeAgo(selected.updatedAt).toLowerCase()}
                </Typography>
              </div>
              <Button
                color="inherit"
                startIcon={<EditIcon />}
                onClick={() => {
                  setNewName(selected.name);
                  setRenaming(selected.id);
                }}
              >
                Rename
              </Button>
              <Button color="error" startIcon={<DeleteOutlineIcon />} onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            </div>
            <JobBrowser
              key={selected.id}
              jobs={selected.jobs}
              listId={selected.id}
              listName={selected.name}
              empty={
                <Paper variant="outlined" className="py-16 text-center">
                  <Typography color="text.secondary">This list is empty.</Typography>
                </Paper>
              }
            />
          </>
        ) : (
          <Paper variant="outlined" className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-20 text-center">
            <BookmarksIcon sx={{ fontSize: 56 }} color="primary" className="opacity-70" />
            <Typography variant="h6">No saved lists</Typography>
            <Typography color="text.secondary" className="max-w-md">
              Select jobs in the search results and choose “Save to list”, or drag a downloaded JSON/CSV file here. CSVs and
              cache files from the open-list CLI (output/*.csv, output/cache/*.json) work too.
            </Typography>
            <Button variant="contained" startIcon={<UploadFileIcon />} onClick={() => fileRef.current?.click()}>
              Import a file
            </Button>
          </Paper>
        )}
      </div>

      <Dialog open={Boolean(renaming)} onClose={() => setRenaming(null)} fullWidth maxWidth="xs">
        <DialogTitle>Rename list</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveRename()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenaming(null)}>Cancel</Button>
          <Button variant="contained" onClick={saveRename} disabled={!newName.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <DialogTitle>Delete “{selected?.name}”?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This removes the list and its {selected?.jobs.length} jobs from this browser. Download it first if you may need it again.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              if (selected) deleteList(selected.id);
              setConfirmDelete(false);
              setSelectedId(null);
              toast('List deleted', 'info');
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
