import { useState } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Avatar, Skeleton, Button,
  TextField, MenuItem, InputAdornment, Stack, Chip, Grid2 as Grid
} from '@mui/material';
import {
  Search as SearchIcon,
  ReceiptLong as ExpenseIcon,
  Handshake as SettlementIcon,
  AccountBalanceWallet as BudgetIcon,
  Comment as CommentIcon,
  EmojiEmotions as ReactIcon,
  Settings as GroupIcon,
  Undo as UndoIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { activityApi, expensesApi, budgetsApi, settlementsApi } from '../../services/api.js';
import { formatRelativeTime } from '../../utils/formatters.js';

const getIcon = (entityType, action) => {
  if (action === 'comment') return <CommentIcon fontSize="small" sx={{ color: 'info.main' }} />;
  if (action === 'react') return <ReactIcon fontSize="small" sx={{ color: 'warning.main' }} />;
  
  switch (entityType) {
    case 'expense': return <ExpenseIcon fontSize="small" sx={{ color: 'primary.main' }} />;
    case 'settlement': return <SettlementIcon fontSize="small" sx={{ color: 'success.main' }} />;
    case 'budget': return <BudgetIcon fontSize="small" sx={{ color: 'secondary.main' }} />;
    case 'group': return <GroupIcon fontSize="small" sx={{ color: 'text.secondary' }} />;
    default: return <GroupIcon fontSize="small" sx={{ color: 'text.secondary' }} />;
  }
};

const renderActivityDetails = (a) => {
  if (a.action === 'comment' && a.payload?.content) {
    return (
      <Box sx={{ mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1, borderLeft: '3px solid', borderColor: 'info.main', maxWidth: '500px' }}>
        <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.primary' }}>
          "{a.payload.content}"
        </Typography>
      </Box>
    );
  }
  if (a.action === 'react' && a.payload?.emoji) {
    return (
      <Box sx={{ mt: 0.5 }}>
        <Chip label={a.payload.emoji} size="small" sx={{ fontSize: 14, height: 24 }} />
      </Box>
    );
  }
  return null;
};

export default function ActivityTimelinePage() {
  const { groupId } = useParams();
  const { group } = useOutletContext();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');

  const isAdmin = group?.myMembership?.role === 'admin';

  const { data, isLoading } = useQuery({
    queryKey: ['activity', groupId],
    queryFn: async () => {
      // Increase limit to 100 so client-side filtering has a healthy dataset
      const { data } = await activityApi.group(groupId, { limit: 100 });
      return data;
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async ({ entityType, entityId }) => {
      if (entityType === 'expense') {
        return expensesApi.restore(groupId, entityId);
      } else if (entityType === 'budget') {
        return budgetsApi.restore(groupId, entityId);
      } else if (entityType === 'settlement') {
        return settlementsApi.restore(groupId, entityId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity', groupId] });
      queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
      queryClient.invalidateQueries({ queryKey: ['budgets', groupId] });
      queryClient.invalidateQueries({ queryKey: ['balances', groupId] });
      queryClient.invalidateQueries({ queryKey: ['settlements', groupId] });
      queryClient.invalidateQueries({ queryKey: ['reports', 'summary', groupId] });
    },
  });

  const activities = data?.data || [];

  // Client-side filtering logic
  const filteredActivities = activities.filter((a) => {
    // 1. Search text filter
    const matchesSearch =
      !searchTerm ||
      a.summary?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.actor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.payload?.content?.toLowerCase().includes(searchTerm.toLowerCase());

    // 2. Entity filter
    let matchesEntity = true;
    if (entityFilter !== 'all') {
      if (entityFilter === 'comment') {
        matchesEntity = a.entity_type === 'comment' || a.action === 'comment';
      } else if (entityFilter === 'react') {
        matchesEntity = a.action === 'react';
      } else {
        matchesEntity = a.entity_type === entityFilter && a.action !== 'comment' && a.action !== 'react';
      }
    }

    // 3. Action filter
    let matchesAction = true;
    if (actionFilter !== 'all') {
      if (actionFilter === 'delete') {
        matchesAction = ['delete', 'void'].includes(a.action);
      } else if (actionFilter === 'approve') {
        matchesAction = ['approve', 'reject', 'reverse'].includes(a.action);
      } else {
        matchesAction = a.action === actionFilter;
      }
    }

    return matchesSearch && matchesEntity && matchesAction;
  });

  if (isLoading) return <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />;

  return (
    <Box>
      <Typography variant="h6" fontWeight={600} gutterBottom>Activity Timeline</Typography>

      {/* Filter Toolbar */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ '&:last-child': { pb: 2 } }}>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                size="small"
                label="Search activities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                select
                fullWidth
                size="small"
                label="Type"
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value)}
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="expense">Expenses</MenuItem>
                <MenuItem value="settlement">Settlements</MenuItem>
                <MenuItem value="budget">Budgets</MenuItem>
                <MenuItem value="comment">Comments</MenuItem>
                <MenuItem value="react">Reactions</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                select
                fullWidth
                size="small"
                label="Action"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              >
                <MenuItem value="all">All Actions</MenuItem>
                <MenuItem value="create">Created</MenuItem>
                <MenuItem value="update">Updated</MenuItem>
                <MenuItem value="delete">Deleted / Voided</MenuItem>
                <MenuItem value="approve">Settlement Decisions</MenuItem>
                <MenuItem value="react">Reactions</MenuItem>
                <MenuItem value="comment">Comments</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Activities Feed */}
      {filteredActivities.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">No matching activities found</Typography>
        </Card>
      ) : (
        <Card>
          <CardContent>
            {filteredActivities.map((a, i) => {
              const isRestorable = isAdmin &&
                (a.action === 'void' || a.action === 'delete') &&
                ['expense', 'budget', 'settlement'].includes(a.entity_type);

              return (
                <Box
                  key={a.id}
                  display="flex"
                  justifyContent="space-between"
                  alignItems="flex-start"
                  py={2}
                  borderBottom={i < filteredActivities.length - 1 ? '1px solid' : 'none'}
                  borderColor="divider"
                  gap={2}
                >
                  <Box display="flex" gap={2} alignItems="flex-start" flex={1}>
                    <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.light' }}>
                      {a.actor_name?.[0]?.toUpperCase()}
                    </Avatar>
                    <Box flex={1}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box display="inline-flex" p={0.5} borderRadius="50%" bgcolor="action.hover">
                          {getIcon(a.entity_type, a.action)}
                        </Box>
                        <Typography variant="body2" fontWeight={600} color="text.primary">
                          {a.actor_name}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                        {a.summary}
                      </Typography>
                      {renderActivityDetails(a)}
                      <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.5 }}>
                        {formatRelativeTime(a.occurred_at)}
                      </Typography>
                    </Box>
                  </Box>
                  {isRestorable && (
                    <Button
                      size="small"
                      variant="outlined"
                      color="secondary"
                      startIcon={<UndoIcon />}
                      onClick={() => restoreMutation.mutate({ entityType: a.entity_type, entityId: a.entity_id })}
                      disabled={restoreMutation.isPending}
                    >
                      Restore
                    </Button>
                  )}
                </Box>
              );
            })}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
