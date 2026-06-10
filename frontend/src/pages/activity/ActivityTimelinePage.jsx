import { useParams, useOutletContext } from 'react-router-dom';
import { Box, Card, CardContent, Typography, Avatar, Skeleton, Button } from '@mui/material';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { activityApi, expensesApi, budgetsApi, settlementsApi } from '../../services/api.js';
import { formatRelativeTime } from '../../utils/formatters.js';

export default function ActivityTimelinePage() {
  const { groupId } = useParams();
  const { group } = useOutletContext();
  const queryClient = useQueryClient();

  const isAdmin = group?.myMembership?.role === 'admin';

  const { data, isLoading } = useQuery({
    queryKey: ['activity', groupId],
    queryFn: async () => {
      const { data } = await activityApi.group(groupId, { limit: 50 });
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

  if (isLoading) return <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />;

  return (
    <Box>
      <Typography variant="h6" fontWeight={600} gutterBottom>Activity Timeline</Typography>
      {activities.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">No activity yet</Typography>
        </Card>
      ) : (
        <Card>
          <CardContent>
            {activities.map((a, i) => {
              const isRestorable = isAdmin &&
                (a.action === 'void' || a.action === 'delete') &&
                ['expense', 'budget', 'settlement'].includes(a.entity_type);

              return (
                <Box
                  key={a.id}
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  py={2}
                  borderBottom={i < activities.length - 1 ? '1px solid' : 'none'}
                  borderColor="divider"
                  gap={2}
                >
                  <Box display="flex" gap={2} alignItems="center">
                    <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.light' }}>
                      {a.actor_name?.[0]}
                    </Avatar>
                    <Box>
                      <Typography variant="body2">{a.summary}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {a.actor_name} · {formatRelativeTime(a.occurred_at)}
                      </Typography>
                    </Box>
                  </Box>
                  {isRestorable && (
                    <Button
                      size="small"
                      variant="outlined"
                      color="secondary"
                      startIcon={<UndoRoundedIcon />}
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
