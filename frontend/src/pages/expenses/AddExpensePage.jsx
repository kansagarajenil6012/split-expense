import { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import {
  Box, Typography, TextField, Button, Card, CardContent, Grid2 as Grid,
  MenuItem, FormControlLabel, Checkbox, Alert, Divider, IconButton
} from '@mui/material';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { useForm, Controller } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expensesApi, groupsApi, eventsApi, corporateApi } from '../../services/api.js';
import { SPLIT_TYPES, formatCurrency } from '../../utils/formatters.js';
import { getErrorMessage } from '../../services/api-client.js';
import { useUIStore } from '../../store/ui.store.js';
import dayjs from 'dayjs';

export default function AddExpensePage() {
  const { groupId } = useParams();
  const { group } = useOutletContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryEventId = searchParams.get('eventId') || '';
  const queryCostCenterId = searchParams.get('costCenterId') || '';
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const showToast = useUIStore((s) => s.showToast);

  const [itemizedItems, setItemizedItems] = useState([{ id: Date.now().toString(), name: '', amount: '', participants: [] }]);
  const [itemizedTax, setItemizedTax] = useState('');
  const [itemizedTip, setItemizedTip] = useState('');

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

  const { data: events } = useQuery({
    queryKey: ['events', groupId],
    queryFn: async () => {
      const { data } = await eventsApi.list(groupId);
      return data.data;
    },
  });

  const { data: costCenters } = useQuery({
    queryKey: ['costCenters', groupId],
    queryFn: async () => {
      const { data } = await corporateApi.getCostCenters(groupId);
      return data.data;
    },
  });

  const { register, handleSubmit, watch, control, reset, formState: { isSubmitting } } = useForm({
    defaultValues: {
      title: '',
      amount: '',
      expenseDate: dayjs().format('YYYY-MM-DD'),
      paidByMemberId: '',
      categoryId: '',
      eventId: queryEventId,
      costCenterId: queryCostCenterId,
      projectName: '',
      approvalStatus: group?.group_type === 'office' ? 'pending' : 'approved',
      splitType: 'equal',
      description: '',
      participants: {},
    },
  });

  const watchAmount = parseFloat(watch('amount') || 0);
  const watchSplitType = watch('splitType');
  const watchParticipants = watch('participants') || {};

  useEffect(() => {
    if (members && Object.keys(watchParticipants).length === 0) {
      const initialParticipants = {};
      members.forEach((m) => {
        initialParticipants[m.id] = {
          isIncluded: true,
          value: '',
        };
      });
      reset({
        title: '',
        amount: '',
        expenseDate: dayjs().format('YYYY-MM-DD'),
        paidByMemberId: '',
        categoryId: '',
        eventId: queryEventId,
        costCenterId: queryCostCenterId,
        projectName: '',
        approvalStatus: group?.group_type === 'office' ? 'pending' : 'approved',
        splitType: 'equal',
        description: '',
        participants: initialParticipants,
      });
    }
  }, [members, reset, queryEventId, queryCostCenterId]);

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

    if (watchSplitType === 'itemized') {
      let memberSubtotal = 0;
      let totalSubtotal = 0;

      itemizedItems.forEach(item => {
        const amt = parseFloat(item.amount) || 0;
        totalSubtotal += amt;
        if (item.participants?.includes(memberId) && item.participants.length > 0) {
          memberSubtotal += amt / item.participants.length;
        }
      });

      if (totalSubtotal <= 0) return 0;
      
      const taxAmt = parseFloat(itemizedTax) || 0;
      const tipAmt = parseFloat(itemizedTip) || 0;
      
      const memberProportion = memberSubtotal / totalSubtotal;
      return memberSubtotal + (memberProportion * taxAmt) + (memberProportion * tipAmt);
    }

    return 0;
  };

  const getSplitAmount = (memberId) => {
    return calculateIndividualShare(memberId);
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

    if (watchSplitType === 'itemized') {
      let totalItems = 0;
      let anyInvalid = false;
      itemizedItems.forEach(i => {
        if (!i.name || !i.amount || !i.participants || i.participants.length === 0) anyInvalid = true;
        totalItems += parseFloat(i.amount) || 0;
      });
      if (anyInvalid) return { isValid: false, message: 'All items must have a name, an amount, and at least 1 person assigned.' };
      
      const taxAmt = parseFloat(itemizedTax) || 0;
      const tipAmt = parseFloat(itemizedTip) || 0;
      const grandTotal = totalItems + taxAmt + tipAmt;
      
      const diff = watchAmount - grandTotal;
      if (Math.abs(diff) > 0.01) {
         return { isValid: false, message: `Sum of items + tax + tip (${formatCurrency(grandTotal, group?.currency)}) must equal total expense amount (${formatCurrency(watchAmount, group?.currency)}). Difference: ${formatCurrency(diff, group?.currency)}`};
      }
      return { isValid: true };
    }

    return { isValid: true };
  };

  const validation = getSplitValidation();

  const createMutation = useMutation({
    mutationFn: (data) => expensesApi.create(groupId, data),
    onSuccess: () => {
      showToast('Expense added successfully');
      queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
      queryClient.invalidateQueries({ queryKey: ['balances', groupId] });
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

    let participants = [];
    let payloadSplitType = formData.splitType;
    let payloadNotes = undefined;

    if (formData.splitType === 'itemized') {
      payloadSplitType = 'unequal';
      const activeMembers = members?.filter((m) => watchParticipants[m.id]?.isIncluded) || [];
      participants = activeMembers.map((m) => ({
        memberId: m.id,
        isIncluded: true,
        shareAmount: parseFloat(getSplitAmount(m.id).toFixed(2)),
      }));
      payloadNotes = JSON.stringify({ itemizedItems, itemizedTax, itemizedTip });
    } else {
      participants = Object.entries(formData.participants)
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
    }

    createMutation.mutate({
      title: formData.title,
      amount: parseFloat(formData.amount),
      expenseDate: formData.expenseDate,
      paidByMemberId: formData.paidByMemberId,
      categoryId: formData.categoryId || null,
      eventId: formData.eventId || null,
      costCenterId: formData.costCenterId || null,
      projectName: formData.projectName || null,
      approvalStatus: formData.approvalStatus || 'approved',
      splitType: payloadSplitType,
      description: formData.description,
      notes: payloadNotes,
      participants,
    });
  };

  return (
    <Box maxWidth={700}>
      <Typography variant="h6" fontWeight={600} gutterBottom>Add Expense</Typography>

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
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth select label="Link to Event/Trip" {...register('eventId')}>
                  <MenuItem value="">None</MenuItem>
                  {events?.map((e) => (
                    <MenuItem key={e.id} value={e.id}>{e.name} ({e.event_type})</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth select label="Cost Center" {...register('costCenterId')}>
                  <MenuItem value="">None</MenuItem>
                  {costCenters?.map((cc) => (
                    <MenuItem key={cc.id} value={cc.id}>{cc.code} - {cc.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Project Name" {...register('projectName')} />
              </Grid>
              {group?.group_type === 'office' && (
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField fullWidth select label="Approval Route" {...register('approvalStatus')}>
                    <MenuItem value="pending">Submit for Manager Approval</MenuItem>
                    <MenuItem value="approved">Auto-Approve (Admin Bypass)</MenuItem>
                  </TextField>
                </Grid>
              )}
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
              {watchSplitType === 'itemized' ? (
                <Grid size={{ xs: 12 }}>
                  <Box sx={{ p: 3, bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 3 }}>
                    <Typography variant="subtitle2" gutterBottom>Receipt Items</Typography>
                    {itemizedItems.map((item, idx) => (
                      <Box key={item.id} sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                        <TextField size="small" label="Item Name" value={item.name} onChange={(e) => {
                          const newItems = [...itemizedItems];
                          newItems[idx].name = e.target.value;
                          setItemizedItems(newItems);
                        }} sx={{ flex: 2, minWidth: 150 }} />
                        <TextField size="small" label="Amount" type="number" inputProps={{ min: 0, step: 0.01 }} value={item.amount} onChange={(e) => {
                          const newItems = [...itemizedItems];
                          newItems[idx].amount = e.target.value;
                          setItemizedItems(newItems);
                        }} sx={{ flex: 1, minWidth: 100 }} />
                        <TextField size="small" select label="Shared By" SelectProps={{ multiple: true }} value={item.participants} onChange={(e) => {
                          const newItems = [...itemizedItems];
                          newItems[idx].participants = e.target.value;
                          setItemizedItems(newItems);
                        }} sx={{ flex: 2, minWidth: 200 }}>
                          {members?.map(m => <MenuItem key={m.id} value={m.id}>{m.full_name}</MenuItem>)}
                        </TextField>
                        <IconButton color="error" onClick={() => setItemizedItems(itemizedItems.filter((_, i) => i !== idx))}><DeleteRoundedIcon /></IconButton>
                      </Box>
                    ))}
                    <Button size="small" variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => setItemizedItems([...itemizedItems, { id: Date.now().toString(), name: '', amount: '', participants: [] }])}>Add Item</Button>
                    
                    <Divider sx={{ my: 3 }} />
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <TextField size="small" label="Total Tax" type="number" inputProps={{ min: 0, step: 0.01 }} value={itemizedTax} onChange={(e) => setItemizedTax(e.target.value)} sx={{ flex: 1 }} />
                      <TextField size="small" label="Total Tip" type="number" inputProps={{ min: 0, step: 0.01 }} value={itemizedTip} onChange={(e) => setItemizedTip(e.target.value)} sx={{ flex: 1 }} />
                    </Box>
                  </Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Final Calculated Shares (including proportional tax/tip):</Typography>
                  <Card variant="outlined">
                    <CardContent sx={{ p: 2, pb: '16px !important' }}>
                      {members?.map(m => {
                        const share = getSplitAmount(m.id);
                        if (share <= 0) return null;
                        return (
                          <Box key={m.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                            <Typography>{m.full_name}</Typography>
                            <Typography fontWeight={600} color="primary.main">{formatCurrency(share, group?.currency)}</Typography>
                          </Box>
                        );
                      })}
                    </CardContent>
                  </Card>
                </Grid>
              ) : (
                members?.map((m) => {
                  const isIncluded = watchParticipants[m.id]?.isIncluded ?? true;
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
                                  checked={field.value ?? true}
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
                              {formatCurrency(getSplitAmount(m.id), group?.currency)}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Grid>
                  );
                })
              )}
            </Grid>

            <Box display="flex" gap={2} mt={4}>
              <Button variant="outlined" onClick={() => navigate(`/groups/${groupId}/expenses`)}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={isSubmitting || !validation.isValid}>
                {isSubmitting ? 'Saving...' : 'Add Expense'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
