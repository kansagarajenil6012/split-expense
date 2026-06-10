import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Grid2 as Grid, Card, CardContent, CardActionArea,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, Chip, Stack, Skeleton, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { groupsApi } from '../../services/api.js';
import { GROUP_TYPES } from '../../utils/formatters.js';
import { getErrorMessage } from '../../services/api-client.js';

export default function GroupsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  const { data: groups, isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const { data } = await groupsApi.list();
      return data.data;
    },
  });

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm({
    defaultValues: { name: '', description: '', groupType: 'general', currency: 'INR' },
  });

  const createMutation = useMutation({
    mutationFn: (data) => groupsApi.create(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      setOpen(false);
      reset();
      navigate(`/groups/${res.data.data.id}`);
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const onSubmit = (data) => {
    setError('');
    createMutation.mutate(data);
  };

  return (
    <Box>
      <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={2} mb={3}>
        <Typography variant="h4" fontWeight={700}>Groups</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpen(true)}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          Create Group
        </Button>
      </Box>

      {isLoading ? (
        <Grid container spacing={2}>
          {[1, 2, 3].map((i) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
              <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      ) : groups?.length === 0 ? (
        <Card sx={{ p: 6, textAlign: 'center' }}>
          <Typography color="text.secondary" gutterBottom>No groups yet. Create one to get started!</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)} sx={{ mt: 2 }}>
            Create Group
          </Button>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {groups.map((group) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={group.id}>
              <Card>
                <CardActionArea onClick={() => navigate(`/groups/${group.id}`)}>
                  <CardContent>
                    <Typography variant="h6" fontWeight={600}>{group.name}</Typography>
                    {group.description && (
                      <Typography variant="body2" color="text.secondary" noWrap>{group.description}</Typography>
                    )}
                    <Stack direction="row" spacing={1} mt={1.5}>
                      <Chip label={GROUP_TYPES.find((t) => t.value === group.group_type)?.label || group.group_type} size="small" />
                      <Chip label={`${group.member_count} members`} size="small" variant="outlined" />
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Group</DialogTitle>
        <Box component="form" onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <TextField fullWidth label="Group Name" margin="normal" required {...register('name')} />
            <TextField fullWidth label="Description" margin="normal" multiline rows={2} {...register('description')} />
            <TextField fullWidth select label="Group Type" margin="normal" defaultValue="general" {...register('groupType')}>
              {GROUP_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </TextField>
            <TextField fullWidth select label="Currency" margin="normal" defaultValue="INR" {...register('currency')}>
              {['INR', 'USD', 'EUR', 'GBP'].map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
