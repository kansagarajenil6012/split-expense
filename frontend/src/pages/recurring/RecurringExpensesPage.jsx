import { useState } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Button, Grid2 as Grid, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Alert, IconButton,
  Tooltip, Chip, Stack, Switch, FormControlLabel,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import RepeatRoundedIcon from '@mui/icons-material/RepeatRounded';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { recurringApi, expensesApi, groupsApi } from '../../services/api.js';
import { formatCurrency, formatDate } from '../../utils/formatters.js';
import { getErrorMessage } from '../../services/api-client.js';
import dayjs from 'dayjs';

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

export default function RecurringExpensesPage() {
  const { groupId } = useParams();
  const { group } = useOutletContext();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    templateTitle: '', amount: '', categoryId: '', paidByMemberId: '',
    splitType: 'equal', frequency: 'monthly', intervalCount: 1,
    nextRunAt: dayjs().add(1, 'month').startOf('month').format('YYYY-MM-DD'),
  });

  const { data: itemsData } = useQuery({
    queryKey: ['recurring', groupId],
    queryFn: async () => {
      const { data } = await recurringApi.list(groupId, { limit: 50 });
      return data;
    },
  });

  const { data: members } = useQuery({
    queryKey: ['members', groupId],
    queryFn: async () => {
      const { data } = await groupsApi.getMembers(groupId);
      return data.data;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', groupId],
    queryFn: async () => {
      const { data } = await expensesApi.getCategories(groupId);
      return data.data;
    },
  });
  const items = itemsData?.data || [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['recurring', groupId] });

  const createMutation = useMutation({
    mutationFn: (data) => recurringApi.create(groupId, data),
    onSuccess: () => { invalidate(); closeDialog(); },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => recurringApi.update(groupId, id, data),
    onSuccess: () => { invalidate(); closeDialog(); },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => recurringApi.delete(groupId, id),
    onSuccess: () => invalidate(),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({
      templateTitle: '', amount: '', categoryId: '', paidByMemberId: '',
      splitType: 'equal', frequency: 'monthly', intervalCount: 1,
      nextRunAt: dayjs().add(1, 'month').startOf('month').format('YYYY-MM-DD'),
    });
    setError('');
    setDialogOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      templateTitle: item.template_title,
      amount: item.amount,
      categoryId: item.category_id || '',
      paidByMemberId: item.paid_by_member_id || '',
      splitType: item.split_type,
      frequency: item.frequency,
      intervalCount: item.interval_count,
      nextRunAt: dayjs(item.next_run_at).format('YYYY-MM-DD'),
    });
    setError('');
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setError('');
  };

  const handleSubmit = () => {
    setError('');
    const payload = {
      templateTitle: form.templateTitle,
      amount: parseFloat(form.amount),
      categoryId: form.categoryId || null,
      paidByMemberId: form.paidByMemberId,
      splitType: form.splitType,
      frequency: form.frequency,
      intervalCount: parseInt(form.intervalCount),
      nextRunAt: form.nextRunAt,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const getFrequencyColor = (freq) => {
    switch (freq) {
      case 'daily': return 'error';
      case 'weekly': return 'warning';
      case 'monthly': return 'primary';
      case 'yearly': return 'success';
      default: return 'default';
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6" fontWeight={600}>Recurring Expenses</Typography>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
          Add Recurring
        </Button>
      </Box>

      {items.length === 0 ? (
        <Card sx={{ p: 5, textAlign: 'center' }}>
          <RepeatRoundedIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" fontWeight={600} gutterBottom>No recurring expenses</Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>Set up automatic expenses like rent, subscriptions, or utilities</Typography>
          <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={openCreate}>Create First Recurring Expense</Button>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {items.map((item) => (
            <Grid size={{ xs: 12, sm: 6 }} key={item.id}>
              <Card sx={{ opacity: item.is_active ? 1 : 0.6 }}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                    <Box>
                      <Typography variant="subtitle1" fontWeight={700}>{item.template_title}</Typography>
                      <Typography variant="h5" fontWeight={800} className="gradient-text" sx={{ mt: 0.5 }}>
                        {formatCurrency(item.amount, group?.currency)}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(item)}><EditRoundedIcon fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => deleteMutation.mutate(item.id)}><DeleteRoundedIcon fontSize="small" /></IconButton></Tooltip>
                    </Stack>
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ mt: 1.5, mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                    <Chip icon={<RepeatRoundedIcon />} label={`Every ${item.interval_count > 1 ? item.interval_count + ' ' : ''}${item.frequency}`} color={getFrequencyColor(item.frequency)} size="small" />
                    {item.category_name && <Chip label={item.category_name} size="small" variant="outlined" />}
                    {!item.is_active && <Chip label="Paused" size="small" color="default" />}
                  </Stack>
                  <Box display="flex" justifyContent="space-between" mt={1}>
                    <Typography variant="caption" color="text.secondary">
                      Next: {formatDate(item.next_run_at)}
                    </Typography>
                    {item.last_run_at && (
                      <Typography variant="caption" color="text.disabled">
                        Last: {formatDate(item.last_run_at)}
                      </Typography>
                    )}
                  </Box>
                  {item.paid_by_name && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      Paid by: {item.paid_by_name}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Recurring Expense' : 'Create Recurring Expense'}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField label="Expense Title" required value={form.templateTitle} onChange={(e) => setForm(f => ({ ...f, templateTitle: e.target.value }))} placeholder="e.g. Netflix Subscription" />
            <TextField label="Amount" type="number" required inputProps={{ min: 1, step: 0.01 }} value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} />
            <TextField select label="Paid By" required value={form.paidByMemberId} onChange={(e) => setForm(f => ({ ...f, paidByMemberId: e.target.value }))}>
              {members?.map(m => <MenuItem key={m.id} value={m.id}>{m.full_name}</MenuItem>)}
            </TextField>
            <TextField select label="Category" value={form.categoryId} onChange={(e) => setForm(f => ({ ...f, categoryId: e.target.value }))}>
              <MenuItem value="">None</MenuItem>
              {categories.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
            <TextField select label="Frequency" value={form.frequency} onChange={(e) => setForm(f => ({ ...f, frequency: e.target.value }))}>
              {FREQUENCIES.map(f => <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>)}
            </TextField>
            <TextField label="Repeat Every (intervals)" type="number" inputProps={{ min: 1 }} value={form.intervalCount} onChange={(e) => setForm(f => ({ ...f, intervalCount: e.target.value }))} helperText={`e.g. 2 = every 2 ${form.frequency === 'monthly' ? 'months' : form.frequency === 'weekly' ? 'weeks' : 'periods'}`} />
            <TextField label="Next Run Date" type="date" InputLabelProps={{ shrink: true }} value={form.nextRunAt} onChange={(e) => setForm(f => ({ ...f, nextRunAt: e.target.value }))} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={!form.templateTitle || !form.amount || !form.paidByMemberId || createMutation.isPending || updateMutation.isPending}>
            {editing ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
