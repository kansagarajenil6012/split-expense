import { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import {
  Box, Typography, TextField, Button, Card, CardContent, Grid2 as Grid,
  MenuItem, FormControlLabel, Checkbox, Alert, Divider, Skeleton,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import { useForm, Controller } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expensesApi, groupsApi, activityApi } from '../../services/api.js';
import { SPLIT_TYPES, formatCurrency } from '../../utils/formatters.js';
import { getErrorMessage } from '../../services/api-client.js';
import { useUIStore } from '../../store/ui.store.js';
import dayjs from 'dayjs';

export default function EditExpensePage() {
  const { groupId, expenseId } = useParams();
  const { group } = useOutletContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const showToast = useUIStore((s) => s.showToast);

  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: expenseData, isLoading: expenseLoading } = useQuery({
    queryKey: ['expense', groupId, expenseId],
    queryFn: async () => {
      const { data } = await expensesApi.get(groupId, expenseId);
      return data.data;
    },
  });
  const expense = expenseData;

  const { data: membersData } = useQuery({
    queryKey: ['members', groupId],
    queryFn: async () => {
      const { data } = await groupsApi.getMembers(groupId);
      return data.data;
    },
  });
  const members = membersData;

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['expense-activity', groupId, expenseId],
    queryFn: async () => {
      const { data } = await activityApi.group(groupId, { entityId: expenseId });
      return data.data.activities;
    },
    enabled: historyOpen,
  });
  const activities = historyData || [];

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', groupId],
    queryFn: async () => {
      const { data } = await expensesApi.getCategories(groupId);
      return data.data;
    },
  });

  const { register, handleSubmit, watch, control, reset, formState: { isSubmitting } } = useForm({
    defaultValues: {
      title: '',
      amount: '',
      expenseDate: '',
      paidByMemberId: '',
      categoryId: '',
      splitType: 'equal',
      description: '',
      participants: {},
    },
  });

  const watchAmount = parseFloat(watch('amount') || 0);
  const watchSplitType = watch('splitType');
  const watchParticipants = watch('participants') || {};

  useEffect(() => {
    if (expense && members) {
      const initialParticipants = {};
      members.forEach((m) => {
        const existingPart = expense.participants?.find((p) => p.member_id === m.id);
        if (existingPart) {
          let val = '';
          if (expense.split_type === 'unequal') {
            val = existingPart.share_amount;
          } else if (expense.split_type === 'percentage') {
            val = existingPart.share_percentage;
          } else if (expense.split_type === 'shares') {
            val = existingPart.share_units;
          }
          initialParticipants[m.id] = {
            isIncluded: true,
            value: val,
          };
        } else {
          initialParticipants[m.id] = {
            isIncluded: false,
            value: '',
          };
        }
      });

      reset({
        title: expense.title || '',
        amount: expense.amount || '',
        expenseDate: expense.expense_date ? dayjs(expense.expense_date).format('YYYY-MM-DD') : '',
        paidByMemberId: expense.paid_by_member_id || '',
        categoryId: expense.category_id || '',
        splitType: expense.split_type || 'equal',
        description: expense.description || '',
        participants: initialParticipants,
      });
    }
  }, [expense, members, reset]);

  const calculateIndividualShare = (memberId) => {
    if (watchAmount <= 0) return 0;

    const activeMembers = members?.filter((m) => watchParticipants[m.id]?.isIncluded) || [];
    if (activeMembers.length === 0) return 0;

    const isActive = watchParticipants[memberId]?.isIncluded;
    if (!isActive) return 0;

    if (watchSplitType === 'equal') {
      return watchAmount / activeMembers.length;
    }

    if (watchSplitType === 'unequal') {
      return parseFloat(watchParticipants[memberId]?.value || 0);
    }

    if (watchSplitType === 'percentage') {
      const pct = parseFloat(watchParticipants[memberId]?.value || 0);
      return (pct / 100) * watchAmount;
    }

    if (watchSplitType === 'shares') {
      const activeShares = activeMembers.map((m) => {
        const val = parseFloat(watchParticipants[m.id]?.value);
        return isNaN(val) || val <= 0 ? 1 : val;
      });
      const totalShares = activeShares.reduce((sum, val) => sum + val, 0);
      if (totalShares <= 0) return 0;

      const myShares = parseFloat(watchParticipants[memberId]?.value);
      const sharesToUse = isNaN(myShares) || myShares <= 0 ? 1 : myShares;
      return (sharesToUse / totalShares) * watchAmount;
    }

    return 0;
  };

  const getSplitValidation = () => {
    const activeMembers = members?.filter((m) => watchParticipants[m.id]?.isIncluded) || [];

    if (activeMembers.length === 0) {
      return { isValid: false, message: 'Select at least one participant.' };
    }

    if (watchSplitType === 'equal') {
      return { isValid: true };
    }

    if (watchSplitType === 'unequal') {
      const totalAllocated = activeMembers.reduce((sum, m) => sum + parseFloat(watchParticipants[m.id]?.value || 0), 0);
      const diff = watchAmount - totalAllocated;
      if (Math.abs(diff) > 0.01) {
        return {
          isValid: false,
          message: `Sum of amounts (${formatCurrency(totalAllocated, group?.currency)}) must equal total amount (${formatCurrency(watchAmount, group?.currency)}). Difference: ${formatCurrency(diff, group?.currency)}`,
        };
      }
      return { isValid: true };
    }

    if (watchSplitType === 'percentage') {
      const totalPct = activeMembers.reduce((sum, m) => sum + parseFloat(watchParticipants[m.id]?.value || 0), 0);
      const diff = 100 - totalPct;
      if (Math.abs(diff) > 0.01) {
        return {
          isValid: false,
          message: `Sum of percentages (${totalPct.toFixed(2)}%) must equal 100%. Difference: ${diff.toFixed(2)}%`,
        };
      }
      return { isValid: true };
    }

    if (watchSplitType === 'shares') {
      const anyInvalid = activeMembers.some((m) => {
        const val = watchParticipants[m.id]?.value;
        if (val !== undefined && val !== '') {
          const parsed = parseFloat(val);
          return isNaN(parsed) || parsed <= 0;
        }
        return false;
      });
      if (anyInvalid) {
        return { isValid: false, message: 'Shares must be positive numbers.' };
      }
      return { isValid: true };
    }

    return { isValid: true };
  };

  const validation = getSplitValidation();

  const updateMutation = useMutation({
    mutationFn: (data) => expensesApi.update(groupId, expenseId, data),
    onSuccess: () => {
      showToast('Expense updated successfully');
      queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
      queryClient.invalidateQueries({ queryKey: ['balances', groupId] });
      queryClient.invalidateQueries({ queryKey: ['expense', groupId, expenseId] });
      navigate(`/groups/${groupId}/expenses`);
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const onSubmit = (formData) => {
    setError('');
    const validationCheck = getSplitValidation();
    if (!validationCheck.isValid) {
      setError(validationCheck.message);
      return;
    }

    const participants = Object.entries(formData.participants)
      .filter(([_, item]) => item.isIncluded)
      .map(([memberId, item]) => {
        const payloadItem = {
          memberId,
          isIncluded: true,
        };
        if (formData.splitType === 'unequal') {
          payloadItem.shareAmount = parseFloat(item.value);
        } else if (formData.splitType === 'percentage') {
          payloadItem.sharePercentage = parseFloat(item.value);
        } else if (formData.splitType === 'shares') {
          payloadItem.shareUnits = parseFloat(item.value || 1);
        }
        return payloadItem;
      });

    updateMutation.mutate({
      title: formData.title,
      amount: parseFloat(formData.amount),
      expenseDate: formData.expenseDate,
      paidByMemberId: formData.paidByMemberId,
      categoryId: formData.categoryId || null,
      splitType: formData.splitType,
      description: formData.description,
      participants,
    });
  };

  if (expenseLoading) {
    return (
      <Box maxWidth={700}>
        <Skeleton variant="text" width={200} height={32} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 3 }} />
      </Box>
    );
  }

  return (
    <Box maxWidth={700}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" fontWeight={600}>Edit Expense</Typography>
        <Button variant="outlined" size="small" startIcon={<HistoryRoundedIcon />} onClick={() => setHistoryOpen(true)}>
          History
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!validation.isValid && watchAmount > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>{validation.message}</Alert>
      )}

      <Card>
        <CardContent>
          <Box component="form" onSubmit={handleSubmit(onSubmit)}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }}>
                <TextField fullWidth label="Title" required {...register('title')} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Amount" type="number" required inputProps={{ min: 0.01, step: 0.01 }} {...register('amount')} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Date" type="date" required InputLabelProps={{ shrink: true }} {...register('expenseDate')} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth select label="Paid by" required {...register('paidByMemberId')}>
                  {members?.map((m) => (
                    <MenuItem key={m.id} value={m.id}>{m.full_name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth select label="Category" {...register('categoryId')}>
                  <MenuItem value="">None</MenuItem>
                  {categories?.map((c) => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField fullWidth select label="Split Type" {...register('splitType')}>
                  {SPLIT_TYPES.map((s) => (
                    <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField fullWidth label="Description" multiline rows={2} {...register('description')} />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>Split Breakdown</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Choose who is included and customize their share of the expense.
            </Typography>

            <Grid container spacing={2}>
              {members?.map((m) => {
                const isIncluded = watchParticipants[m.id]?.isIncluded ?? false;
                return (
                  <Grid size={{ xs: 12 }} key={m.id}>
                    <Box display="flex" alignItems="center" justifyContent="space-between" gap={2} sx={{ py: 1 }}>
                      <FormControlLabel
                        control={
                          <Controller
                            name={`participants.${m.id}.isIncluded`}
                            control={control}
                            render={({ field }) => (
                              <Checkbox
                                checked={field.value ?? false}
                                onChange={(e) => field.onChange(e.target.checked)}
                              />
                            )}
                          />
                        }
                        label={m.full_name}
                        sx={{ flex: 1, margin: 0 }}
                      />

                      {isIncluded && watchSplitType !== 'equal' && (
                        <Controller
                          name={`participants.${m.id}.value`}
                          control={control}
                          render={({ field }) => (
                            <TextField
                              size="small"
                              type="number"
                              label={
                                watchSplitType === 'unequal' ? `Amount (${group?.currency})` :
                                watchSplitType === 'percentage' ? 'Percent (%)' : 'Shares'
                              }
                              required
                              inputProps={{
                                min: 0.01,
                                step: watchSplitType === 'shares' ? 1 : 0.01,
                              }}
                              value={field.value ?? ''}
                              onChange={(e) => field.onChange(e.target.value)}
                              sx={{ width: 150 }}
                            />
                          )}
                        />
                      )}

                      {isIncluded && (
                        <Box sx={{ width: 120, textAlign: 'right' }}>
                          <Typography variant="body2" fontWeight={600} color="primary.light">
                            {formatCurrency(calculateIndividualShare(m.id), group?.currency)}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Grid>
                );
              })}
            </Grid>

            <Box display="flex" gap={2} mt={4}>
              <Button variant="outlined" onClick={() => navigate(`/groups/${groupId}/expenses`)}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={isSubmitting || !validation.isValid}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Expense History</DialogTitle>
        <DialogContent dividers>
          {historyLoading ? (
            <Skeleton variant="rectangular" height={200} />
          ) : activities.length === 0 ? (
            <Typography color="text.secondary">No history found for this expense.</Typography>
          ) : (
            <Box sx={{ position: 'relative', pl: 2, '&::before': { content: '""', position: 'absolute', left: 8, top: 10, bottom: 0, width: 2, bgcolor: 'divider' } }}>
              {activities.map((act) => (
                <Box key={act.id} sx={{ position: 'relative', mb: 3, pl: 3 }}>
                  <Box sx={{ position: 'absolute', left: -9, top: 4, width: 12, height: 12, borderRadius: '50%', bgcolor: 'primary.main', border: '2px solid', borderColor: 'background.paper' }} />
                  <Typography variant="body2" color="text.secondary" fontWeight={500} mb={0.5}>
                    {new Date(act.occurred_at).toLocaleString()}
                  </Typography>
                  <Typography fontWeight={600} gutterBottom>{act.actor_name}</Typography>
                  <Typography variant="body2" color="text.secondary">{act.summary}</Typography>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
