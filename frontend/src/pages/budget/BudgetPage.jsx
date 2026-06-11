import { useState } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Button, Grid2 as Grid, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Alert, LinearProgress, IconButton,
  Tooltip, Chip, Stack,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { budgetsApi, expensesApi, groupsApi } from '../../services/api.js';
import { formatCurrency, formatDate } from '../../utils/formatters.js';
import { getErrorMessage } from '../../services/api-client.js';
import dayjs from 'dayjs';

const PERIODS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom' },
];

const getPeriodDates = (period) => {
  const now = dayjs();
  switch (period) {
    case 'weekly':
      return { start: now.startOf('week').format('YYYY-MM-DD'), end: now.endOf('week').format('YYYY-MM-DD') };
    case 'monthly':
      return { start: now.startOf('month').format('YYYY-MM-DD'), end: now.endOf('month').format('YYYY-MM-DD') };
    case 'quarterly':
      return { start: now.startOf('quarter').format('YYYY-MM-DD'), end: now.endOf('quarter').format('YYYY-MM-DD') };
    case 'yearly':
      return { start: now.startOf('year').format('YYYY-MM-DD'), end: now.endOf('year').format('YYYY-MM-DD') };
    default:
      return { start: now.format('YYYY-MM-DD'), end: now.add(1, 'month').format('YYYY-MM-DD') };
  }
};

export default function BudgetPage() {
  const { groupId } = useParams();
  const { group } = useOutletContext();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', amountLimit: '', categoryId: '', memberId: '', budgetType: 'group', period: 'monthly',
    periodStart: '', periodEnd: '', alertThresholdPct: 80,
  });

  const { data: budgetsData, isLoading } = useQuery({
    queryKey: ['budgets', groupId],
    queryFn: async () => {
      const { data } = await budgetsApi.list(groupId, { limit: 50 });
      return data;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', groupId],
    queryFn: async () => {
      const { data } = await expensesApi.getCategories(groupId);
      return data.data;
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ['members', groupId],
    queryFn: async () => {
      const { data } = await groupsApi.getMembers(groupId);
      return data.data;
    },
  });

  const budgets = budgetsData?.data || [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['budgets', groupId] });

  const createMutation = useMutation({
    mutationFn: (data) => budgetsApi.create(groupId, data),
    onSuccess: () => { invalidate(); closeDialog(); },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => budgetsApi.update(groupId, id, data),
    onSuccess: () => { invalidate(); closeDialog(); },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => budgetsApi.delete(groupId, id),
    onSuccess: () => invalidate(),
  });

  const openCreate = () => {
    const dates = getPeriodDates('monthly');
    setEditingBudget(null);
    setForm({
      name: '', amountLimit: '', categoryId: '', memberId: '', budgetType: 'group', period: 'monthly',
      periodStart: dates.start, periodEnd: dates.end, alertThresholdPct: 80,
    });
    setError('');
    setDialogOpen(true);
  };

  const openEdit = (b) => {
    setEditingBudget(b);
    setForm({
      name: b.name,
      amountLimit: b.amount_limit,
      categoryId: b.category_id || '',
      memberId: b.member_id || '',
      budgetType: b.budget_type || 'group',
      period: b.period,
      periodStart: dayjs(b.period_start).format('YYYY-MM-DD'),
      periodEnd: dayjs(b.period_end).format('YYYY-MM-DD'),
      alertThresholdPct: b.alert_threshold_pct,
    });
    setError('');
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingBudget(null);
    setError('');
  };

  const handlePeriodChange = (newPeriod) => {
    const dates = getPeriodDates(newPeriod);
    setForm(f => ({ ...f, period: newPeriod, periodStart: dates.start, periodEnd: dates.end }));
  };

  const handleSubmit = () => {
    setError('');
    const payload = {
      name: form.name,
      amountLimit: parseFloat(form.amountLimit),
      categoryId: form.budgetType === 'category' ? (form.categoryId || null) : null,
      memberId: form.budgetType === 'member' ? (form.memberId || null) : null,
      budgetType: form.budgetType,
      period: form.period,
      periodStart: form.periodStart,
      periodEnd: form.periodEnd,
      alertThresholdPct: parseInt(form.alertThresholdPct),
    };
    if (editingBudget) {
      updateMutation.mutate({ id: editingBudget.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const getProgressColor = (pct) => {
    if (pct >= 100) return 'error';
    if (pct >= 80) return 'warning';
    return 'success';
  };

  const getStatusChip = (pct) => {
    if (pct >= 100) return <Chip icon={<WarningAmberRoundedIcon />} label="Exceeded" color="error" size="small" />;
    if (pct >= 80) return <Chip icon={<WarningAmberRoundedIcon />} label="Warning" color="warning" size="small" />;
    return <Chip icon={<CheckCircleRoundedIcon />} label="On Track" color="success" size="small" />;
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6" fontWeight={600}>Budget Management</Typography>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
          Create Budget
        </Button>
      </Box>

      {budgets.length === 0 ? (
        <Card sx={{ p: 5, textAlign: 'center' }}>
          <WarningAmberRoundedIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" fontWeight={600} gutterBottom>No budgets set</Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>Create a budget to track spending limits for this group</Typography>
          <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={openCreate}>Create First Budget</Button>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {budgets.map((b) => {
            const spent = parseFloat(b.spent_amount) || 0;
            const limit = parseFloat(b.amount_limit);
            const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
            const remaining = limit - spent;

            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={b.id}>
                <Card sx={{
                  height: '100%',
                  border: pct >= 100 ? '2px solid' : 'none',
                  borderColor: pct >= 100 ? 'error.main' : undefined,
                  animation: pct >= 100 ? 'pulse 2s infinite' : undefined,
                }}>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                      <Box>
                        <Typography variant="subtitle1" fontWeight={700}>{b.name}</Typography>
                        <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} flexWrap="wrap" gap={0.5}>
                          <Chip
                            label={b.budget_type?.toUpperCase() || 'GROUP'}
                            size="small"
                            variant="outlined"
                            color={b.budget_type === 'category' ? 'secondary' : b.budget_type === 'member' ? 'info' : 'primary'}
                            sx={{ height: 20, fontSize: 10 }}
                          />
                          {b.budget_type === 'category' && b.category_name && (
                            <Chip label={b.category_name} size="small" sx={{ height: 20, fontSize: 10 }} />
                          )}
                          {b.budget_type === 'member' && b.member_name && (
                            <Chip label={b.member_name} size="small" sx={{ height: 20, fontSize: 10 }} />
                          )}
                        </Stack>
                      </Box>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(b)}><EditRoundedIcon fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => deleteMutation.mutate(b.id)}><DeleteRoundedIcon fontSize="small" /></IconButton></Tooltip>
                      </Stack>
                    </Box>

                    {getStatusChip(pct)}

                    <Box sx={{ mt: 2, mb: 1 }}>
                      <Box display="flex" justifyContent="space-between" mb={0.5}>
                        <Typography variant="body2" color="text.secondary">Spent</Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {formatCurrency(spent, group?.currency)} / {formatCurrency(limit, group?.currency)}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(pct, 100)}
                        color={getProgressColor(pct)}
                        sx={{ height: 10, borderRadius: 5 }}
                      />
                      <Box display="flex" justifyContent="space-between" mt={0.5}>
                        <Typography variant="caption" color="text.secondary">{pct}% used</Typography>
                        <Typography variant="caption" color={remaining < 0 ? 'error.main' : 'text.secondary'}>
                          {remaining >= 0 ? `${formatCurrency(remaining, group?.currency)} left` : `${formatCurrency(Math.abs(remaining), group?.currency)} over`}
                        </Typography>
                      </Box>
                    </Box>

                    <Box mt={2} display="flex" justifyContent="space-between">
                      <Typography variant="caption" color="text.disabled">
                        {formatDate(b.period_start)} - {formatDate(b.period_end)}
                      </Typography>
                      <Chip label={b.period} size="small" variant="outlined" />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingBudget ? 'Edit Budget' : 'Create Budget'}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField label="Budget Name" required value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Monthly Food Budget" />
            <TextField label="Amount Limit" type="number" required inputProps={{ min: 1, step: 0.01 }} value={form.amountLimit} onChange={(e) => setForm(f => ({ ...f, amountLimit: e.target.value }))} />
            
            <TextField select label="Budget Type" value={form.budgetType} onChange={(e) => setForm(f => ({ ...f, budgetType: e.target.value }))}>
              <MenuItem value="group">Group-wide</MenuItem>
              <MenuItem value="category">Category-based</MenuItem>
              <MenuItem value="member">Member-based</MenuItem>
            </TextField>

            {form.budgetType === 'category' && (
              <TextField select required label="Category" value={form.categoryId} onChange={(e) => setForm(f => ({ ...f, categoryId: e.target.value }))}>
                <MenuItem value="">Select Category</MenuItem>
                {categories.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </TextField>
            )}

            {form.budgetType === 'member' && (
              <TextField select required label="Member" value={form.memberId} onChange={(e) => setForm(f => ({ ...f, memberId: e.target.value }))}>
                <MenuItem value="">Select Member</MenuItem>
                {members.map(m => <MenuItem key={m.id} value={m.id}>{m.full_name}</MenuItem>)}
              </TextField>
            )}

            <TextField select label="Period" value={form.period} onChange={(e) => handlePeriodChange(e.target.value)}>
              {PERIODS.map(p => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
            </TextField>
            <Box display="flex" gap={2}>
              <TextField fullWidth label="Start Date" type="date" InputLabelProps={{ shrink: true }} value={form.periodStart} onChange={(e) => setForm(f => ({ ...f, periodStart: e.target.value }))} />
              <TextField fullWidth label="End Date" type="date" InputLabelProps={{ shrink: true }} value={form.periodEnd} onChange={(e) => setForm(f => ({ ...f, periodEnd: e.target.value }))} />
            </Box>
            <TextField label="Alert Threshold (%)" type="number" inputProps={{ min: 1, max: 100 }} value={form.alertThresholdPct} onChange={(e) => setForm(f => ({ ...f, alertThresholdPct: e.target.value }))} helperText="You'll be notified when spending exceeds this percentage" />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={!form.name || !form.amountLimit || (form.budgetType === 'category' && !form.categoryId) || (form.budgetType === 'member' && !form.memberId) || createMutation.isPending || updateMutation.isPending}>
            {editingBudget ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
