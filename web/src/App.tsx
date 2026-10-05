import { useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Badge from '@mui/material/Badge';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useColorScheme } from '@mui/material/styles';
import KeyIcon from '@mui/icons-material/Key';
import SettingsIcon from '@mui/icons-material/SettingsOutlined';
import DarkModeIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeIcon from '@mui/icons-material/LightModeOutlined';
import SearchIcon from '@mui/icons-material/Search';
import BookmarksIcon from '@mui/icons-material/BookmarksOutlined';
import BoltIcon from '@mui/icons-material/Bolt';
import { useAppStore } from './store/useAppStore';
import SearchPage from './pages/SearchPage';
import ListsPage from './pages/ListsPage';
import TokenDialog from './components/TokenDialog';
import SettingsDialog from './components/SettingsDialog';
import QuotaDialog from './components/QuotaDialog';
import { usageView } from './lib/quota';
import { Toaster } from './components/common';
import { formatDate } from './lib/ui';

function ThemeToggle() {
  const { mode, systemMode, setMode } = useColorScheme();
  const dark = (mode === 'system' ? systemMode : mode) === 'dark';
  return (
    <Tooltip title={dark ? 'Light mode' : 'Dark mode'}>
      <IconButton color="inherit" onClick={() => setMode(dark ? 'light' : 'dark')}>
        {dark ? <LightModeIcon /> : <DarkModeIcon />}
      </IconButton>
    </Tooltip>
  );
}

export default function App() {
  const hydrated = useAppStore((s) => s.hydrated);
  const apiKey = useAppStore((s) => s.apiKey);
  const usage = useAppStore((s) => s.usage);
  const settings = useAppStore((s) => s.settings);
  const listCount = useAppStore((s) => s.lists.length);
  const [tab, setTab] = useState<'search' | 'lists'>('search');
  const [tokenOpen, setTokenOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quotaOpen, setQuotaOpen] = useState(false);

  if (!hydrated) {
    return (
      <div className="flex h-full items-center justify-center">
        <CircularProgress />
      </div>
    );
  }

  const quota = usageView(usage, settings);
  const quotaLow = quota.remaining / quota.limit < 0.15;

  return (
    <div className="flex min-h-full flex-col">
      <AppBar position="sticky" color="inherit" sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar className="gap-1 sm:gap-2">
          <div className="flex items-center gap-2 sm:mr-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-teal-500 text-white">
              <BoltIcon fontSize="small" />
            </div>
            <Typography variant="h6" className="hidden font-bold tracking-tight sm:block">
              Open List
            </Typography>
          </div>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} className="min-h-16" sx={{ '& .MuiTab-root': { minHeight: 64 } }}>
            <Tab value="search" icon={<SearchIcon />} iconPosition="start" label={<span className="hidden sm:inline">Search</span>} className="min-w-0 px-3 sm:px-4" />
            <Tab
              value="lists"
              icon={<BookmarksIcon />}
              iconPosition="start"
              className="min-w-0 px-3 sm:px-4"
              label={
                <Badge badgeContent={listCount} color="primary" className="pr-3">
                  <span className="hidden sm:inline">Lists</span>
                </Badge>
              }
            />
          </Tabs>
          <div className="flex-1" />
          {apiKey && (
            <Tooltip title={`${quota.used} of ${quota.limit} used · resets ${formatDate(quota.resetsAt.toISOString())}. Click to sync or edit.`}>
              <Chip
                size="small"
                variant="outlined"
                color={quotaLow ? 'warning' : 'default'}
                label={`${quota.exact ? '' : '~'}${quota.remaining}/${quota.limit} requests left`}
                onClick={() => setQuotaOpen(true)}
                className="hidden md:flex"
              />
            </Tooltip>
          )}
          <Button
            color={apiKey ? 'inherit' : 'primary'}
            variant={apiKey ? 'text' : 'contained'}
            startIcon={<KeyIcon />}
            onClick={() => setTokenOpen(true)}
            className="whitespace-nowrap"
          >
            <span className="hidden sm:inline">{apiKey ? 'API key ✓' : 'Add API key'}</span>
          </Button>
          <Tooltip title="Settings">
            <IconButton color="inherit" onClick={() => setSettingsOpen(true)}>
              <SettingsIcon />
            </IconButton>
          </Tooltip>
          <ThemeToggle />
        </Toolbar>
      </AppBar>

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col p-3 sm:p-6">
        {tab === 'search' ? <SearchPage onOpenToken={() => setTokenOpen(true)} onOpenQuota={() => setQuotaOpen(true)} /> : <ListsPage />}
      </main>

      <TokenDialog open={tokenOpen} onClose={() => setTokenOpen(false)} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <QuotaDialog open={quotaOpen} onClose={() => setQuotaOpen(false)} />
      <Toaster />
    </div>
  );
}
