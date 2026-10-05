import { useMemo, type ReactNode } from 'react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import LanguageIcon from '@mui/icons-material/Language';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd';
import PlaceIcon from '@mui/icons-material/Place';
import WorkIcon from '@mui/icons-material/WorkOutlined';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PaymentsIcon from '@mui/icons-material/PaymentsOutlined';
import SourceIcon from '@mui/icons-material/Public';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import type { SvgIconComponent } from '@mui/icons-material';
import type { Job, JobStatus } from '../types';
import { useAppStore } from '../store/useAppStore';
import { CompanyAvatar, ScoreChip } from './common';
import { STATUSES, STATUS_META, formatDate, timeAgo } from '../lib/ui';

/** Wrap matched skills in <mark> so they stand out in the description. */
function highlight(text: string, terms: string[]): ReactNode {
  const clean = terms.filter((t) => t.length > 1).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!clean.length) return text;
  const re = new RegExp(`(${clean.join('|')})`, 'gi');
  return text.split(re).map((part, i) =>
    i % 2 ? (
      <mark key={i} className="rounded bg-amber-200 px-0.5 text-inherit dark:bg-amber-500/30">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

interface Props {
  job: Job | null;
  listId: string | null;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onSave?: (job: Job) => void;
}

export default function JobDetailDrawer({ job, listId, onClose, onPrev, onNext, onSave }: Props) {
  const updateJob = useAppStore((s) => s.updateJob);
  const description = useMemo(() => (job ? highlight(job.description, job.matchedSkills) : null), [job]);

  const facts: [SvgIconComponent, string][] = job
    ? ([
        [PlaceIcon, job.remote ? `${job.location || 'Anywhere'} · Remote` : job.location],
        [WorkIcon, job.employmentType],
        [TrendingUpIcon, job.experience && `Experience: ${job.experience}`],
        [PaymentsIcon, job.salary],
        [ScheduleIcon, job.postedAt && `Posted ${formatDate(job.postedAt)} (${timeAgo(job.postedAt)})`],
        [SourceIcon, job.source && `via ${job.source}`],
      ].filter(([, v]) => v) as [SvgIconComponent, string][])
    : [];

  return (
    <Drawer
      anchor="right"
      open={Boolean(job)}
      onClose={onClose}
      slotProps={{ paper: { className: 'w-full sm:w-[600px]' } }}
    >
      {job && (
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-1 px-3 py-2">
            <Tooltip title="Previous job">
              <span>
                <IconButton onClick={onPrev} disabled={!onPrev}>
                  <ChevronLeftIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Next job">
              <span>
                <IconButton onClick={onNext} disabled={!onNext}>
                  <ChevronRightIcon />
                </IconButton>
              </span>
            </Tooltip>
            <div className="flex-1" />
            <IconButton onClick={onClose} aria-label="Close">
              <CloseIcon />
            </IconButton>
          </div>
          <Divider />

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="flex items-start gap-4">
              <CompanyAvatar name={job.company} logo={job.companyLogo} size={52} />
              <div className="min-w-0 flex-1">
                <Typography variant="h6" className="leading-snug font-semibold">
                  {job.title}
                </Typography>
                <Typography color="text.secondary">{job.company}</Typography>
              </div>
              <ScoreChip score={job.score} size="medium" />
            </div>

            <div className="mt-4 flex flex-col gap-1.5">
              {facts.map(([Icon, text], i) => (
                <div key={i} className="flex items-center gap-2 text-sm opacity-80">
                  <Icon fontSize="small" />
                  <span>{text}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {job.applyLink && (
                <Button variant="contained" endIcon={<OpenInNewIcon />} href={job.applyLink} target="_blank" rel="noreferrer">
                  Apply
                </Button>
              )}
              {job.companyWebsite && (
                <Button variant="outlined" startIcon={<LanguageIcon />} href={job.companyWebsite} target="_blank" rel="noreferrer">
                  Website
                </Button>
              )}
              {onSave && (
                <Button variant="outlined" startIcon={<BookmarkAddIcon />} onClick={() => onSave(job)}>
                  Save to list
                </Button>
              )}
            </div>

            {listId && (
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[180px_1fr]">
                <TextField
                  select
                  size="small"
                  label="Status"
                  value={job.status}
                  onChange={(e) => updateJob(listId, job.id, { status: e.target.value as JobStatus })}
                >
                  {STATUSES.map((s) => (
                    <MenuItem key={s} value={s}>
                      {STATUS_META[s].label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  label="Notes"
                  multiline
                  maxRows={4}
                  value={job.notes}
                  onChange={(e) => updateJob(listId, job.id, { notes: e.target.value })}
                />
              </div>
            )}

            {job.matchedSkills.length > 0 && (
              <div className="mt-6">
                <Typography variant="overline" color="text.secondary">
                  Matched skills
                </Typography>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {job.matchedSkills.map((s) => (
                    <Chip key={s} label={s} size="small" color="primary" variant="outlined" />
                  ))}
                </div>
              </div>
            )}

            <Divider className="my-6" />
            <Typography variant="overline" color="text.secondary">
              Description
            </Typography>
            {job.description ? (
              <Typography component="div" variant="body2" className="mt-2 leading-relaxed break-words whitespace-pre-line">
                {description}
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary" className="mt-2">
                No description available (e.g. imported from a CSV without descriptions).
              </Typography>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
