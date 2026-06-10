import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom';
import { Box, Tabs, Tab, Typography, Breadcrumbs, Link, Skeleton, Chip, Stack } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { groupsApi } from '../services/api.js';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

export default function GroupLayout() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: group, isLoading } = useQuery({
    queryKey: ['groups', groupId],
    queryFn: async () => {
      const { data } = await groupsApi.get(groupId);
      return data.data;
    },
  });

  const tabs = [
    { label: 'Overview', path: `/groups/${groupId}` },
    { label: 'Expenses', path: `/groups/${groupId}/expenses` },
    { label: 'Settlement', path: `/groups/${groupId}/settlement` },
  ];

  tabs.push({ label: 'Events', path: `/groups/${groupId}/events` });

  if (group?.group_type === 'office') {
    tabs.push({ label: 'Corporate', path: `/groups/${groupId}/corporate` });
  }

  if (group?.group_type === 'food_club' || group?.group_type === 'sports') {
    tabs.push({ label: 'Club Tool', path: `/groups/${groupId}/club` });
  }

  tabs.push(
    { label: 'Budgets', path: `/groups/${groupId}/budgets` },
    { label: 'Recurring', path: `/groups/${groupId}/recurring` },
    { label: 'Reports', path: `/groups/${groupId}/reports` },
    { label: 'Activity', path: `/groups/${groupId}/activity` }
  );

  const currentTab = tabs.findIndex((t) =>
    t.path === location.pathname ||
    (t.label === 'Expenses' && location.pathname.includes('/expenses')) ||
    (t.label === 'Budgets' && location.pathname.includes('/budgets')) ||
    (t.label === 'Events' && location.pathname.includes('/events')) ||
    (t.label === 'Corporate' && location.pathname.includes('/corporate')) ||
    (t.label === 'Club Tool' && location.pathname.includes('/club'))
  );

  if (isLoading) {
    return (
      <Box>
        <Skeleton variant="text" width={200} height={32} sx={{ mb: 1 }} />
        <Skeleton variant="text" width={300} height={48} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={44} sx={{ borderRadius: 2, mb: 3 }} />
        <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 3 }} />
      </Box>
    );
  }

  return (
    <Box>
      <Breadcrumbs
        separator={<ArrowForwardIosIcon sx={{ fontSize: 10 }} />}
        sx={{ mb: 1.5 }}
      >
        <Link
          underline="hover"
          sx={{ cursor: 'pointer', color: 'text.secondary', fontSize: '0.85rem', '&:hover': { color: 'primary.main' } }}
          onClick={() => navigate('/groups')}
        >
          Groups
        </Link>
        <Typography color="text.primary" fontSize="0.85rem" fontWeight={500}>{group?.name}</Typography>
      </Breadcrumbs>

      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
        <Typography variant="h4" fontWeight={700}>
          {group?.name}
        </Typography>
        <Chip
          label={group?.group_type?.replace('_', ' ')}
          size="small"
          sx={{ textTransform: 'capitalize' }}
        />
      </Stack>

      {group?.description && (
        <Typography color="text.secondary" sx={{ mb: 2 }}>{group.description}</Typography>
      )}

      <Tabs
        value={currentTab >= 0 ? currentTab : 0}
        onChange={(_, idx) => navigate(tabs[idx].path)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          mb: 3,
          borderBottom: 1,
          borderColor: 'rgba(139, 92, 246, 0.08)',
        }}
      >
        {tabs.map((tab) => (
          <Tab key={tab.path} label={tab.label} />
        ))}
      </Tabs>

      <Box sx={{ animation: 'fadeInUp 0.25s ease forwards' }}>
        <Outlet context={{ group }} />
      </Box>
    </Box>
  );
}
