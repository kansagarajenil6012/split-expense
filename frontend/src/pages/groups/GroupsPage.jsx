import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Grid2 as Grid, Card, CardContent, CardActionArea,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, Chip, Stack, Skeleton, Alert, Checkbox, FormControlLabel, Select, FormControl, InputLabel
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FilterListIcon from '@mui/icons-material/FilterList';
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
  
  // Filtering state
  const [showArchived, setShowArchived] = useState(false);
  const [selectedTag, setSelectedTag] = useState('');

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

  // Get all unique tags from active groups
  const allTags = Array.from(
    new Set(
      groups
        ?.filter(g => !g.is_archived || showArchived)
        ?.flatMap((g) => g.tags || []) || []
    )
  );

  // Apply filters
  const filteredGroups = groups?.filter((group) => {
    if (group.is_archived && !showArchived) return false;
    if (selectedTag && !(group.tags || []).includes(selectedTag)) return false;
    return true;
  });

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

      {/* Filter Toolbar */}
      <Card sx={{ p: 2, mb: 3, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ color: 'text.secondary', mr: 2 }}>
          <FilterListIcon size="small" />
          <Typography variant="body2" fontWeight={600}>Filters:</Typography>
        </Stack>

        <FormControlLabel
          control={
            <Checkbox
              checked={showArchived}
              onChange={(e) => {
                setShowArchived(e.target.checked);
                // Clear selected tag filter if it isn't relevant anymore
                if (!e.target.checked && selectedTag) {
                  setSelectedTag('');
                }
              }}
            />
          }
          label={<Typography variant="body2">Show Archived Groups</Typography>}
        />

        {allTags.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Filter by Tag</InputLabel>
            <Select
              value={selectedTag}
              label="Filter by Tag"
              onChange={(e) => setSelectedTag(e.target.value)}
            >
              <MenuItem value=""><em>All Tags</em></MenuItem>
              {allTags.map((tag) => (
                <MenuItem key={tag} value={tag}>{tag}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Card>

      {isLoading ? (
        <Grid container spacing={2}>
          {[1, 2, 3].map((i) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
              <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      ) : filteredGroups?.length === 0 ? (
        <Card sx={{ p: 6, textAlign: 'center' }}>
          <Typography color="text.secondary" gutterBottom>
            {groups?.length > 0 ? 'No groups match your active filters.' : 'No groups yet. Create one to get started!'}
          </Typography>
          {groups?.length === 0 && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)} sx={{ mt: 2 }}>
              Create Group
            </Button>
          )}
        </Card>
      ) : (
        <Grid container spacing={2}>
          {filteredGroups.map((group) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={group.id}>
              <Card sx={{ opacity: group.is_archived ? 0.7 : 1, position: 'relative' }}>
                <CardActionArea onClick={() => navigate(`/groups/${group.id}`)}>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                      <Typography variant="h6" fontWeight={600}>{group.name}</Typography>
                      {group.is_archived && (
                        <Chip label="Archived" color="warning" size="small" sx={{ height: 20, fontSize: '0.65rem' }} />
                      )}
                    </Box>
                    {group.description && (
                      <Typography variant="body2" color="text.secondary" noWrap mt={0.5}>{group.description}</Typography>
                    )}
                    
                    {/* Render Tags */}
                    {group.tags && group.tags.length > 0 && (
                      <Stack direction="row" spacing={0.5} mt={1.5} flexWrap="wrap" gap={0.5}>
                        {group.tags.map((tag) => (
                          <Chip
                            key={tag}
                            label={tag}
                            size="small"
                            sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(0,0,0,0.06)' }}
                          />
                        ))}
                      </Stack>
                    )}

                    <Stack direction="row" spacing={1} mt={2}>
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
