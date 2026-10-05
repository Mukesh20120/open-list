import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  DataGrid,
  GridActionsCellItem,
  useGridApiRef,
  type GridColDef,
  type GridRowSelectionModel,
} from '@mui/x-data-grid';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import TableRowsIcon from '@mui/icons-material/TableRows';
import GridViewIcon from '@mui/icons-material/GridView';
import DownloadIcon from '@mui/icons-material/Download';
import DataObjectIcon from '@mui/icons-material/DataObject';
import DescriptionIcon from '@mui/icons-material/Description';
import TableChartIcon from '@mui/icons-material/TableChart';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import FlagIcon from '@mui/icons-material/OutlinedFlag';
import CloseIcon from '@mui/icons-material/Close';
import type { Job, JobStatus } from '../types';
import { useAppStore } from '../store/useAppStore';
import { downloadCsv, downloadExcel, downloadJson } from '../lib/files';
import JobFilters from './JobFilters';
import { EMPTY_FILTERS, applyFilters, type Filters } from '../lib/filters';
import JobDetailDrawer from './JobDetailDrawer';
import SaveToListDialog from './SaveToListDialog';
import { CompanyAvatar, ScoreChip, StatusChip } from './common';
import { STATUSES, STATUS_META, timeAgo, toast } from '../lib/ui';

type View = 'table' | 'cards';
const VIEW_KEY = 'open-list:view';
const readView = (): View => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'cards' ? 'cards' : 'table';
  } catch {
    return 'table';
  }
};

interface Props {
  jobs: Job[];
  listId: string | null; // null = current search results
  listName: string;
  newIds?: string[];
  empty: ReactNode;
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-xl leading-tight font-semibold tabular-nums">{value}</span>
      <span className="text-xs opacity-60">{label}</span>
    </div>
  );
}

export default function JobBrowser({ jobs, listId, listName, newIds = [], empty }: Props) {
  const minScore = useAppStore((s) => s.settings.minScore);
  const updateJob = useAppStore((s) => s.updateJob);
  const removeJobsFromList = useAppStore((s) => s.removeJobsFromList);
  const apiRef = useGridApiRef();

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [view, setView] = useState<View>(readView);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [navOrder, setNavOrder] = useState<string[]>([]);
  const [saveJobs, setSaveJobs] = useState<Job[] | null>(null);
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null);
  const [statusAnchor, setStatusAnchor] = useState<HTMLElement | null>(null);
  const [cardLimit, setCardLimit] = useState(60);

  const newSet = useMemo(() => new Set(newIds), [newIds]);
  const sources = useMemo(() => [...new Set(jobs.map((j) => j.source).filter(Boolean))].sort(), [jobs]);
  const filtered = useMemo(
    () => applyFilters(jobs, filters, { minScore, newIds: newSet }).sort((a, b) => b.score - a.score),
    [jobs, filters, minScore, newSet],
  );
  const selectedJobs = useMemo(() => jobs.filter((j) => selection.has(j.id)), [jobs, selection]);
  const openJob = jobs.find((j) => j.id === openId) ?? null;

  const stats = useMemo(() => {
    const good = filtered.filter((j) => j.score >= minScore).length;
    const remote = filtered.filter((j) => j.remote).length;
    const avg = filtered.length ? filtered.reduce((a, j) => a + j.score, 0) / filtered.length : 0;
    const fresh = filtered.filter((j) => newSet.has(j.id)).length;
    const applied = filtered.filter((j) => j.status !== 'none' && j.status !== 'interested').length;
    return { good, remote, avg, fresh, applied };
  }, [filtered, minScore, newSet]);

  const changeView = (v: View | null) => {
    if (!v) return;
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* storage unavailable: keep the choice for this session only */
    }
  };

  // Prev/next in the drawer follows the order on screen when it was opened
  const openDetails = useCallback(
    (id: string) => {
      const visible = new Set(filtered.map((j) => j.id));
      setNavOrder(
        view === 'table' && apiRef.current
          ? apiRef.current.getSortedRowIds().map(String).filter((rid) => visible.has(rid))
          : filtered.map((j) => j.id),
      );
      setOpenId(id);
    },
    [filtered, view, apiRef],
  );
  const neighbour = (delta: number) => {
    const i = navOrder.indexOf(openId ?? '');
    const next = navOrder[i + delta];
    return i >= 0 && next ? () => setOpenId(next) : undefined;
  };

  // ---- export ----
  const exportTarget = selection.size ? selectedJobs : filtered;
  const isWholeList = !selection.size && filtered.length === jobs.length;
  const exportLabel = selection.size ? `${selection.size} selected` : isWholeList ? `all ${jobs.length}` : `${filtered.length} filtered`;
  const doExport = async (kind: 'json' | 'csv' | 'xlsx') => {
    setExportAnchor(null);
    const name = isWholeList ? listName : `${listName} (${exportLabel})`;
    try {
      if (kind === 'json') {
        const list = listId ? useAppStore.getState().lists.find((l) => l.id === listId) : undefined;
        downloadJson(isWholeList && list ? list : { name, jobs: exportTarget });
      } else if (kind === 'csv') downloadCsv(name, exportTarget);
      else await downloadExcel(name, exportTarget, minScore);
      toast(`Downloaded ${exportTarget.length} jobs`);
    } catch (err) {
      toast(`Export failed: ${(err as Error).message}`, 'error');
    }
  };

  const setBulkStatus = (status: JobStatus) => {
    setStatusAnchor(null);
    if (!listId) return;
    for (const j of selectedJobs) updateJob(listId, j.id, { status });
    toast(`Marked ${selectedJobs.length} job(s) as ${STATUS_META[status].label}`);
  };

  const removeSelected = () => {
    if (!listId) return;
    const n = selection.size;
    removeJobsFromList(listId, [...selection]);
    setSelection(new Set());
    toast(`Removed ${n} job(s) from the list`, 'info');
  };

  // ---- table ----
  const columns: GridColDef<Job>[] = useMemo(() => {
    const cols: GridColDef<Job>[] = [
      {
        field: 'score',
        headerName: 'Score',
        type: 'number',
        width: 96,
        align: 'center',
        headerAlign: 'center',
        renderCell: ({ value }) => <ScoreChip score={value} />,
      },
      {
        field: 'title',
        headerName: 'Job title',
        flex: 1.6,
        minWidth: 240,
        renderCell: ({ row }) => (
          <div className="flex h-full items-center gap-2 overflow-hidden">
            <span className="truncate font-medium">{row.title}</span>
            {newSet.has(row.id) && <Chip label="NEW" size="small" color="success" className="h-5 text-[10px] font-bold" />}
          </div>
        ),
      },
      {
        field: 'company',
        headerName: 'Company',
        flex: 1,
        minWidth: 170,
        renderCell: ({ row }) => (
          <div className="flex h-full items-center gap-2 overflow-hidden">
            <CompanyAvatar name={row.company} logo={row.companyLogo} size={24} />
            <span className="truncate">{row.company}</span>
          </div>
        ),
      },
      {
        field: 'location',
        headerName: 'Location',
        width: 170,
        renderCell: ({ row }) => (
          <div className="flex h-full items-center gap-1.5 overflow-hidden">
            <span className="truncate">{row.location || '—'}</span>
            {row.remote && <Chip label="Remote" size="small" color="secondary" variant="outlined" className="h-5 text-[11px]" />}
          </div>
        ),
      },
      { field: 'remote', headerName: 'Remote', type: 'boolean', width: 80 },
      { field: 'experience', headerName: 'Experience', width: 110 },
      {
        field: 'matchedSkills',
        headerName: 'Matched skills',
        flex: 1.2,
        minWidth: 240,
        sortable: false,
        valueGetter: (v: string[]) => v.join(', '),
        renderCell: ({ row }) => (
          <div className="flex h-full items-center gap-1 overflow-hidden">
            {row.matchedSkills.slice(0, 3).map((s) => (
              <Chip key={s} label={s} size="small" variant="outlined" className="h-5 text-[11px]" />
            ))}
            {row.matchedSkills.length > 3 && (
              <Tooltip title={row.matchedSkills.slice(3).join(', ')}>
                <span className="text-xs opacity-60">+{row.matchedSkills.length - 3}</span>
              </Tooltip>
            )}
          </div>
        ),
      },
      {
        field: 'postedAt',
        headerName: 'Posted',
        type: 'date',
        width: 110,
        valueGetter: (v: string) => (v ? new Date(v) : null),
        renderCell: ({ row }) => (
          <Tooltip title={row.postedAt ? new Date(row.postedAt).toLocaleString() : ''}>
            <span>{timeAgo(row.postedAt) || '—'}</span>
          </Tooltip>
        ),
      },
      { field: 'salary', headerName: 'Salary', width: 140 },
      { field: 'source', headerName: 'Source', width: 120 },
      { field: 'employmentType', headerName: 'Type', width: 110 },
      { field: 'query', headerName: 'Search', width: 200 },
    ];
    if (listId) {
      // Status right after the title: tracking applications is what lists are for
      cols.splice(2, 0, {
        field: 'status',
        headerName: 'Status',
        width: 130,
        editable: true,
        type: 'singleSelect',
        valueOptions: STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label })),
        renderCell: ({ row }) => <StatusChip status={row.status} />,
      });
      cols.push({ field: 'notes', headerName: 'Notes', width: 180, editable: true });
    }
    cols.push({
      field: 'actions',
      type: 'actions',
      width: 90,
      getActions: ({ row }) => [
        <GridActionsCellItem key="d" icon={<InfoOutlinedIcon />} label="Details" onClick={() => openDetails(row.id)} />,
        <GridActionsCellItem
          key="a"
          icon={<OpenInNewIcon />}
          label="Apply"
          disabled={!row.applyLink}
          onClick={() => window.open(row.applyLink, '_blank', 'noopener')}
        />,
      ],
    });
    return cols;
  }, [listId, newSet, openDetails]);

  const selectionModel: GridRowSelectionModel = { type: 'include', ids: selection };
  const onSelectionChange = (m: GridRowSelectionModel) => {
    const ids = m.type === 'include' ? [...m.ids] : filtered.map((j) => j.id).filter((id) => !m.ids.has(id));
    setSelection(new Set(ids.map(String)));
  };

  if (!jobs.length) return <>{empty}</>;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <Paper variant="outlined" className="flex flex-col gap-4 p-4">
        <JobFilters
          value={filters}
          onChange={setFilters}
          sources={sources}
          showStatus={Boolean(listId)}
          showNew={!listId && newIds.length > 0}
          minScore={minScore}
        />
        <Divider />
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <Stat label={filtered.length === jobs.length ? 'jobs' : `of ${jobs.length} jobs`} value={filtered.length} />
          <Stat label={`good matches (≥ ${minScore})`} value={stats.good} />
          <Stat label="remote" value={stats.remote} />
          <Stat label="avg. score" value={stats.avg.toFixed(1)} />
          {!listId && newIds.length > 0 && <Stat label="new" value={stats.fresh} />}
          {listId && <Stat label="applied +" value={stats.applied} />}
          <div className="flex-1" />
          <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => changeView(v)}>
            <ToggleButton value="table" aria-label="Table view">
              <TableRowsIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="cards" aria-label="Card view">
              <GridViewIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={(e) => setExportAnchor(e.currentTarget)} disabled={!exportTarget.length}>
            Download
          </Button>
        </div>
      </Paper>

      {selection.size > 0 && (
        <Paper className="flex flex-wrap items-center gap-2 px-4 py-2" sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>
          <Typography variant="body2" className="mr-2 font-semibold">
            {selection.size} selected
          </Typography>
          <Button size="small" color="inherit" startIcon={<BookmarkAddIcon />} onClick={() => setSaveJobs(selectedJobs)}>
            {listId ? 'Copy to list' : 'Save to list'}
          </Button>
          {listId && (
            <>
              <Button size="small" color="inherit" startIcon={<FlagIcon />} onClick={(e) => setStatusAnchor(e.currentTarget)}>
                Set status
              </Button>
              <Button size="small" color="inherit" startIcon={<DeleteOutlineIcon />} onClick={removeSelected}>
                Remove
              </Button>
            </>
          )}
          <div className="flex-1" />
          <Button size="small" color="inherit" startIcon={<CloseIcon />} onClick={() => setSelection(new Set())}>
            Clear
          </Button>
        </Paper>
      )}

      {!selection.size && !listId && filtered.length > 0 && (
        <div className="-mt-1 flex justify-end">
          <Button size="small" startIcon={<BookmarkAddIcon />} onClick={() => setSaveJobs(filtered)}>
            Save {filtered.length === jobs.length ? 'all' : `${filtered.length} filtered`} jobs to a list
          </Button>
        </div>
      )}

      {view === 'table' ? (
        <Paper variant="outlined" className="min-h-[480px] flex-1 overflow-hidden">
          <DataGrid
            apiRef={apiRef}
            rows={filtered}
            columns={columns}
            getRowId={(r) => r.id}
            checkboxSelection
            disableRowSelectionOnClick
            rowSelectionModel={selectionModel}
            onRowSelectionModelChange={onSelectionChange}
            onRowClick={({ id }) => openDetails(String(id))}
            processRowUpdate={(row: Job) => {
              if (listId) updateJob(listId, row.id, { status: row.status, notes: row.notes });
              return row;
            }}
            initialState={{
              sorting: { sortModel: [{ field: 'score', sort: 'desc' }] },
              pagination: { paginationModel: { pageSize: 50 } },
              columns: { columnVisibilityModel: { remote: false, employmentType: false, query: false, source: false, notes: false } },
            }}
            pageSizeOptions={[25, 50, 100]}
            rowHeight={52}
            showToolbar
            sx={{
              border: 0,
              '& .MuiDataGrid-row': { cursor: 'pointer' },
              '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 600 },
            }}
          />
        </Paper>
      ) : (
        <div className="flex flex-col gap-4">
          {!filtered.length && (
            <Typography color="text.secondary" className="py-12 text-center">
              No jobs match these filters.
            </Typography>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.slice(0, cardLimit).map((j) => (
              <Card key={j.id} variant="outlined" className="relative flex flex-col transition-shadow hover:shadow-md">
                <Checkbox
                  size="small"
                  className="absolute top-1 right-1 z-10"
                  checked={selection.has(j.id)}
                  onChange={(e) => {
                    const next = new Set(selection);
                    if (e.target.checked) next.add(j.id);
                    else next.delete(j.id);
                    setSelection(next);
                  }}
                  slotProps={{ input: { 'aria-label': `Select ${j.title}` } }}
                />
                <CardActionArea onClick={() => openDetails(j.id)} className="flex flex-1 flex-col items-stretch justify-start p-4">
                  <div className="flex items-start gap-3 pr-8">
                    <CompanyAvatar name={j.company} logo={j.companyLogo} size={40} />
                    <div className="min-w-0 flex-1">
                      <Typography className="line-clamp-2 leading-snug font-semibold">{j.title}</Typography>
                      <Typography variant="body2" color="text.secondary" className="truncate">
                        {j.company}
                      </Typography>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <ScoreChip score={j.score} />
                    {newSet.has(j.id) && <Chip label="NEW" size="small" color="success" />}
                    {j.remote && <Chip label="Remote" size="small" color="secondary" variant="outlined" />}
                    {listId && j.status !== 'none' && <StatusChip status={j.status} />}
                    {j.experience && <Chip label={j.experience} size="small" variant="outlined" />}
                  </div>
                  <Typography variant="body2" color="text.secondary" className="mt-2 truncate">
                    {[j.location, j.salary, timeAgo(j.postedAt), j.source].filter(Boolean).join(' · ')}
                  </Typography>
                  {j.matchedSkills.length > 0 && (
                    <Typography variant="caption" className="mt-2 line-clamp-1 opacity-70">
                      {j.matchedSkills.join(' · ')}
                    </Typography>
                  )}
                </CardActionArea>
              </Card>
            ))}
          </div>
          {filtered.length > cardLimit && (
            <Button className="self-center" onClick={() => setCardLimit((n) => n + 60)}>
              Show more ({filtered.length - cardLimit} remaining)
            </Button>
          )}
        </div>
      )}

      <Menu anchorEl={exportAnchor} open={Boolean(exportAnchor)} onClose={() => setExportAnchor(null)}>
        <Typography variant="caption" color="text.secondary" className="block px-4 pb-1">
          Download {exportLabel} jobs as
        </Typography>
        <MenuItem onClick={() => doExport('json')}>
          <ListItemIcon>
            <DataObjectIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="JSON" secondary="Full data, can be imported back" />
        </MenuItem>
        <MenuItem onClick={() => doExport('csv')}>
          <ListItemIcon>
            <DescriptionIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="CSV" secondary="Spreadsheets, can be imported back" />
        </MenuItem>
        <MenuItem onClick={() => doExport('xlsx')}>
          <ListItemIcon>
            <TableChartIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Excel" secondary="Styled workbook with a Companies sheet" />
        </MenuItem>
      </Menu>

      <Menu anchorEl={statusAnchor} open={Boolean(statusAnchor)} onClose={() => setStatusAnchor(null)}>
        {STATUSES.map((s) => (
          <MenuItem key={s} onClick={() => setBulkStatus(s)}>
            <StatusChip status={s} />
          </MenuItem>
        ))}
      </Menu>

      <JobDetailDrawer
        job={openJob}
        listId={listId}
        onClose={() => setOpenId(null)}
        onPrev={neighbour(-1)}
        onNext={neighbour(1)}
        onSave={(job) => setSaveJobs([job])}
      />

      <SaveToListDialog
        open={Boolean(saveJobs)}
        jobs={saveJobs ?? []}
        excludeListId={listId ?? undefined}
        defaultName={listId ? '' : listName}
        onClose={() => setSaveJobs(null)}
        onSaved={() => setSelection(new Set())}
      />
    </div>
  );
}
