import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Grid2 as Grid, Card, CardContent, CardActionArea,
  Button, Skeleton, Chip, Stack, Avatar, LinearProgress,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { useQuery } from '@tanstack/react-query';
import { groupsApi, activityApi } from '../../services/api.js';
import { formatRelativeTime, formatCurrency } from '../../utils/formatters.js';
import { useAuthStore } from '../../store/auth.store.js';

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const { data: groups, isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const { data } = await groupsApi.list();
      return data.data;
    },
  });

  const { data: activities } = useQuery({
    queryKey: ['activity', 'user'],
    queryFn: async () => {
      const { data } = await activityApi.user({ limit: 10 });
      return data.data;
    },
  });

  const balances = useMemo(() => {
    if (!groups) return { youOwe: 0, youAreOwed: 0, total: 0 };
    let youOwe = 0;
    let youAreOwed = 0;
    
    groups.forEach((g) => {
      const b = parseFloat(g.user_balance) || 0;
      if (b > 0) youOwe += b;
      else if (b < 0) youAreOwed += Math.abs(b);
    });
    
    return {
      youOwe,
      youAreOwed,
      total: youAreOwed - youOwe,
    };
  }, [groups]);

  const defaultCurrency = groups?.[0]?.currency || 'INR';

  const statCards = [
    {
      label: 'You Owe',
      value: formatCurrency(balances.youOwe, defaultCurrency),
      icon: <TrendingDownRoundedIcon />,
      gradient: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(220,38,38,0.1))',
      iconColor: '#ef4444',
    },
    {
      label: 'You are Owed',
      value: formatCurrency(balances.youAreOwed, defaultCurrency),
      icon: <TrendingUpRoundedIcon />,
      gradient: 'linear-gradient(135deg, rgba(52,211,153,0.15), rgba(16,185,129,0.1))',
      iconColor: '#34d399',
    },
    {
      label: 'Total Balance',
      value: formatCurrency(Math.abs(balances.total), defaultCurrency),
      prefix: balances.total < 0 ? '-' : balances.total > 0 ? '+' : '',
      icon: <AccountBalanceWalletRoundedIcon />,
      gradient: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.1))',
      iconColor: '#818cf8',
    },
  ];

  return (
    <Box>
      {/* Header */}
      <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={2} mb={4}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Hello, {user?.full_name?.split(' ')[0] || 'there'} 👋
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>Your expense overview at a glance</Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddRoundedIcon />}
          onClick={() => navigate('/groups')}
          size="large"
          fullWidth={false}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          New Group
        </Button>
      </Box>

      {/* Stat Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statCards.map((stat, i) => (
          <Grid size={{ xs: 12, sm: 4 }} key={i}>
            <Card sx={{ background: stat.gradient, border: 'none' }}>
              <CardContent sx={{ py: 3 }}>
                <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: 2.5,
                      background: 'rgba(255,255,255,0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: stat.iconColor,
                    }}
                  >
                    {stat.icon}
                  </Box>
                  <Typography color="text.secondary" fontSize="0.85rem">{stat.label}</Typography>
                </Stack>
                <Typography variant="h3" fontWeight={800}>
                  {stat.prefix}{stat.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Groups */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" fontWeight={600}>Your Groups</Typography>
        {groups?.length > 0 && (
          <Button size="small" endIcon={<ArrowForwardRoundedIcon />} onClick={() => navigate('/groups')}>
            View All
          </Button>
        )}
      </Box>

      {isLoading ? (
        <Grid container spacing={2}>
          {[1, 2, 3].map((i) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
              <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 3 }} />
            </Grid>
          ))}
        </Grid>
      ) : groups?.length === 0 ? (
        <Card sx={{ p: 5, textAlign: 'center' }}>
          <GroupsRoundedIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" fontWeight={600} gutterBottom>No groups yet</Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>Create your first group and start splitting expenses</Typography>
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => navigate('/groups')}>
            Create your first group
          </Button>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {groups?.slice(0, 6).map((group, idx) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={group.id}>
              <Card sx={{ animation: `fadeInUp 0.3s ease ${idx * 0.05}s both` }}>
                <CardActionArea onClick={() => navigate(`/groups/${group.id}`)} sx={{ p: 0.5 }}>
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={1.5} mb={1.5}>
                      <Avatar
                        sx={{
                          width: 40,
                          height: 40,
                          fontSize: 16,
                          background: `linear-gradient(135deg, ${['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'][idx % 6]}, ${['#a855f7','#34d399','#fbbf24','#f87171','#c084fc','#22d3ee'][idx % 6]})`,
                        }}
                      >
                        {group.name?.[0]?.toUpperCase()}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle1" fontWeight={600} color="text.primary" noWrap>
                          {group.name}
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip label={group.group_type?.replace('_', ' ')} size="small" sx={{ textTransform: 'capitalize' }} />
                      <Chip label={`${group.member_count} members`} size="small" variant="outlined" />
                      <Chip label={group.currency} size="small" variant="outlined" />
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Activity */}
      {activities?.length > 0 && (
        <Box mt={5}>
          <Typography variant="h6" fontWeight={600} gutterBottom>Recent Activity</Typography>
          <Card>
            <CardContent sx={{ p: 0 }}>
              {activities.slice(0, 5).map((a, i) => (
                <Box
                  key={a.id}
                  display="flex"
                  alignItems="center"
                  gap={2}
                  px={2.5}
                  py={1.5}
                  borderBottom={i < Math.min(activities.length, 5) - 1 ? '1px solid' : 'none'}
                  borderColor="divider"
                  sx={{ '&:hover': { bgcolor: 'action.hover' }, transition: 'background 0.2s' }}
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                      flexShrink: 0,
                    }}
                  />
                  <Box flex={1} minWidth={0}>
                    <Typography variant="body2" fontWeight={500} noWrap>{a.summary}</Typography>
                    <Typography variant="caption" color="text.disabled">
                      {formatRelativeTime(a.occurred_at)}
                      {a.group_name && ` · ${a.group_name}`}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
}
