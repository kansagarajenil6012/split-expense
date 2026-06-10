import { Box, Typography, Card, CardContent, IconButton, Button, Chip, Skeleton } from '@mui/material';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import DeleteIcon from '@mui/icons-material/Delete';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../../services/api.js';
import { formatRelativeTime } from '../../utils/formatters.js';

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await notificationsApi.list({ limit: 50 });
      return data.data;
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => notificationsApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  if (isLoading) return <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight={700}>Notifications</Typography>
        <Button startIcon={<DoneAllIcon />} onClick={() => markAllMutation.mutate()}>
          Mark all read
        </Button>
      </Box>

      {notifications?.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">No notifications</Typography>
        </Card>
      ) : (
        <Card>
          <CardContent sx={{ p: 0 }}>
            {notifications.map((n, i) => (
              <Box
                key={n.id}
                display="flex"
                alignItems="center"
                gap={2}
                px={2}
                py={1.5}
                bgcolor={n.is_read ? 'transparent' : 'action.hover'}
                borderBottom={i < notifications.length - 1 ? '1px solid' : 'none'}
                borderColor="divider"
              >
                <Box flex={1}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography fontWeight={n.is_read ? 400 : 600}>{n.title}</Typography>
                    {!n.is_read && <Chip label="New" size="small" color="primary" />}
                  </Box>
                  <Typography variant="body2" color="text.secondary">{n.body}</Typography>
                  <Typography variant="caption" color="text.disabled">{formatRelativeTime(n.created_at)}</Typography>
                </Box>
                {!n.is_read && (
                  <IconButton size="small" onClick={() => markReadMutation.mutate(n.id)}>
                    <DoneAllIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            ))}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
