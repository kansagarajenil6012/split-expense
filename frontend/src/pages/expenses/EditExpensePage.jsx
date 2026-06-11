import { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import {
  Box, Typography, TextField, Button, Card, CardContent, Grid2 as Grid,
  MenuItem, FormControlLabel, Checkbox, Alert, Divider, Skeleton,
  Dialog, DialogTitle, DialogContent, DialogActions, Stack, Chip,
  IconButton, List, ListItem, ListItemText, FormControl, InputLabel, Select
} from '@mui/material';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloseIcon from '@mui/icons-material/Close';
import { useForm, Controller } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { expensesApi, groupsApi } from '../../services/api.js';
import { formatCurrency } from '../../utils/formatters.js';
import { getErrorMessage } from '../../services/api-client.js';
import { useUIStore } from '../../store/ui.store.js';
import dayjs from 'dayjs';

const EXTENDED_SPLIT_TYPES = [
  { value: 'equal', label: 'Equally' },
  { value: 'unequal', label: 'Unequally (Exact amounts)' },
  { value: 'percentage', label: 'By Percentage' },
  { value: 'shares', label: 'By Shares' },
  { value: 'item_wise', label: 'Item-wise' },
  { value: 'days_wise', label: 'Days-wise' },
  { value: 'consumption_wise', label: 'Consumption-wise' },
  { value: 'hybrid', label: 'Hybrid Split' },
];

export default function EditExpensePage() {
  const { groupId, expenseId } = useParams();
  const { group } = useOutletContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const showToast = useUIStore((s) => s.showToast);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [changeReason, setChangeReason] = useState('');

  // Attachments state
  const [newAttachments, setNewAttachments] = useState([]);
  const [existingAttachments, setExistingAttachments] = useState([]);

  // Multiple payers state
  const [isMultiplePayers, setIsMultiplePayers] = useState(false);
  const [multiplePayersData, setMultiplePayersData] = useState({});

  // Item-wise state
  const [itemWiseItems, setItemWiseItems] = useState([
    { id: Date.now().toString(), name: '', amount: '', participants: [] }
  ]);

  // Days-wise, Consumption-wise, Hybrid states
  const [memberDaysData, setMemberDaysData] = useState({});
  const [memberConsumptionData, setMemberConsumptionData] = useState({});
  const [hybridConfigData, setHybridConfigData] = useState({});

  const { data: expenseData, isLoading: expenseLoading } = useQuery({
    queryKey: ['expense', groupId, expenseId],
    queryFn: async () => {
      const { data } = await expensesApi.get(groupId, expenseId);
      return data.data;
    },
  });

  const { data: members } = useQuery({
    queryKey: ['members', groupId],
    queryFn: async () => {
      const { data } = await groupsApi.getMembers(groupId);
      return data.data;
    },
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['expense-revisions', groupId, expenseId],
    queryFn: async () => {
      const { data } = await expensesApi.getHistory(groupId, expenseId);
      return data.data;
    },
    enabled: historyOpen,
  });
  const revisions = historyData || [];

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
      isDraft: false,
      participants: {},
    },
  });

  const watchAmount = parseFloat(watch('amount') || 0);
  const watchSplitType = watch('splitType');
  const watchParticipants = watch('participants') || {};

  // Populate form with existing expense details
  useEffect(() => {
    if (expenseData && members) {
      const expense = expenseData;

      // Existing attachments
      setExistingAttachments(expense.attachments || []);

      // Multiple Payers populated
      const hasMultiplePayers = expense.payers && expense.payers.length > 0;
      setIsMultiplePayers(hasMultiplePayers);
      const payerMap = {};
      members.forEach(m => {
        const matchingPayer = expense.payers?.find(p => p.member_id === m.id);
        payerMap[m.id] = matchingPayer ? matchingPayer.amount : '';
      });
      setMultiplePayersData(payerMap);

      // Custom Splits populated
      const daysMap = {};
      const consMap = {};
      const hybMap = {};
      members.forEach(m => {
        daysMap[m.id] = 1;
        consMap[m.id] = 1;
        hybMap[m.id] = { method: 'equal', value: '' };
      });

      if (expense.split_type === 'days_wise' && expense.participants) {
        expense.participants.forEach(p => {
          if (p.share_units) daysMap[p.member_id] = p.share_units;
        });
      }
      if (expense.split_type === 'consumption_wise' && expense.participants) {
        expense.participants.forEach(p => {
          if (p.share_units) consMap[p.member_id] = p.share_units;
        });
      }
      setMemberDaysData(daysMap);
      setMemberConsumptionData(consMap);

      // Item-wise items
      if (expense.split_type === 'item_wise' && expense.items) {
        setItemWiseItems(
          expense.items.map(item => ({
            id: item.id,
            name: item.name,
            amount: item.amount,
            participants: item.participants?.map(p => p.member_id) || []
          }))
        );
      } else {
        setItemWiseItems([{ id: Date.now().toString(), name: '', amount: '', participants: [] }]);
      }

      // Participants checkbox setup
      const initialParticipants = {};
      members.forEach((m) => {
        const existingPart = expense.participants?.find((p) => p.member_id === m.id);
        if (existingPart) {
          let val = '';
          if (expense.split_type === 'unequal') val = existingPart.share_amount;
          else if (expense.split_type === 'percentage') val = existingPart.share_percentage;
          else if (expense.split_type === 'shares') val = existingPart.share_units;
          
          initialParticipants[m.id] = { isIncluded: true, value: val };
        } else {
          initialParticipants[m.id] = { isIncluded: false, value: '' };
        }
      });

      reset({
        title: expense.title || '',
        amount: expense.amount || '',
        expenseDate: expense.expense_date ? dayjs(expense.expense_date).format('YYYY-MM-DD') : '',
        paidByMemberId: expense.paid_by_member_id || members[0]?.id || '',
        categoryId: expense.category_id || '',
        splitType: expense.split_type || 'equal',
        description: expense.description || '',
        isDraft: expense.is_draft || false,
        participants: initialParticipants,
      });
    }
  }, [expenseData, members, reset]);

  // Dropzone setup
  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'image/*': [], 'application/pdf': [] },
    maxFiles: 5,
    onDrop: (acceptedFiles) => {
      setNewAttachments([...newAttachments, ...acceptedFiles].slice(0, 5));
    }
  });

  const removeNewAttachment = (index) => {
    setNewAttachments(newAttachments.filter((_, i) => i !== index));
  };

  const deleteExistingAttachmentMutation = useMutation({
    mutationFn: (attachmentId) => expensesApi.deleteAttachment(groupId, expenseId, attachmentId),
    onSuccess: (res, attachmentId) => {
      showToast('Attachment deleted successfully');
      setExistingAttachments(existingAttachments.filter(a => a.id !== attachmentId));
    },
    onError: (err) => showToast(getErrorMessage(err), 'error'),
  });

  const getSplitAmount = (memberId) => {
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
      const activeSharesSum = activeMembers.reduce((sum, m) => {
        const val = parseFloat(watchParticipants[m.id]?.value || 1);
        return sum + (isNaN(val) || val <= 0 ? 1 : val);
      }, 0);
      if (activeSharesSum <= 0) return 0;

      const myShares = parseFloat(watchParticipants[memberId]?.value || 1);
      const sharesToUse = isNaN(myShares) || myShares <= 0 ? 1 : myShares;
      return (sharesToUse / activeSharesSum) * watchAmount;
    }

    if (watchSplitType === 'days_wise') {
      const activeDaysSum = activeMembers.reduce((sum, m) => sum + parseFloat(memberDaysData[m.id] || 0), 0);
      if (activeDaysSum <= 0) return 0;
      return ((parseFloat(memberDaysData[memberId] || 0)) / activeDaysSum) * watchAmount;
    }

    if (watchSplitType === 'consumption_wise') {
      const activeUnitsSum = activeMembers.reduce((sum, m) => sum + parseFloat(memberConsumptionData[m.id] || 0), 0);
      if (activeUnitsSum <= 0) return 0;
      return ((parseFloat(memberConsumptionData[memberId] || 0)) / activeUnitsSum) * watchAmount;
    }

    if (watchSplitType === 'item_wise') {
      let memberShare = 0;
      itemWiseItems.forEach((item) => {
        const itemAmount = parseFloat(item.amount) || 0;
        const itemParts = item.participants || [];
        if (itemParts.includes(memberId) && itemParts.length > 0) {
          memberShare += itemAmount / itemParts.length;
        }
      });
      return memberShare;
    }

    if (watchSplitType === 'hybrid') {
      const configs = activeMembers.map(m => ({
        memberId: m.id,
        method: hybridConfigData[m.id]?.method || 'equal',
        value: parseFloat(hybridConfigData[m.id]?.value || 0),
      }));

      const fixed = configs.filter(c => c.method === 'fixed');
      const percentage = configs.filter(c => c.method === 'percentage');
      const equal = configs.filter(c => c.method === 'equal');

      const fixedTotal = fixed.reduce((s, c) => s + c.value, 0);
      if (fixedTotal > watchAmount) return 0;

      let remaining = watchAmount - fixedTotal;

      const pctTotal = percentage.reduce((s, c) => s + c.value, 0);
      if (pctTotal > 100) return 0;

      const myConfig = configs.find(c => c.memberId === memberId);
      if (!myConfig) return 0;

      if (myConfig.method === 'fixed') return myConfig.value;
      if (myConfig.method === 'percentage') return (myConfig.value / 100) * remaining;

      const pctSpent = percentage.reduce((s, c) => s + (c.value / 100) * remaining, 0);
      const equalRemaining = remaining - pctSpent;
      if (equalRemaining < 0) return 0;

      if (myConfig.method === 'equal' && equal.length > 0) {
        return equalRemaining / equal.length;
      }
    }

    return 0;
  };

  const getSplitValidation = () => {
    const activeMembers = members?.filter((m) => watchParticipants[m.id]?.isIncluded) || [];
    if (activeMembers.length === 0) {
      return { isValid: false, message: 'Select at least one participant.' };
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
    }

    if (watchSplitType === 'item_wise') {
      let itemsTotal = 0;
      let anyInvalid = false;
      itemWiseItems.forEach((item) => {
        if (!item.name || !item.amount || !item.participants || item.participants.length === 0) {
          anyInvalid = true;
        }
        itemsTotal += parseFloat(item.amount) || 0;
      });

      if (anyInvalid) {
        return { isValid: false, message: 'All items must have a name, amount, and at least 1 shared member assigned.' };
      }

      const diff = watchAmount - itemsTotal;
      if (Math.abs(diff) > 0.01) {
        return {
          isValid: false,
          message: `Sum of item amounts (${formatCurrency(itemsTotal, group?.currency)}) must equal total expense amount (${formatCurrency(watchAmount, group?.currency)}). Difference: ${formatCurrency(diff, group?.currency)}`,
        };
      }
    }

    if (isMultiplePayers) {
      const payersSum = Object.values(multiplePayersData).reduce((sum, val) => sum + parseFloat(val || 0), 0);
      const diff = watchAmount - payersSum;
      if (Math.abs(diff) > 0.01) {
        return {
          isValid: false,
          message: `Sum of payer amounts (${formatCurrency(payersSum, group?.currency)}) must equal total amount (${formatCurrency(watchAmount, group?.currency)}). Difference: ${formatCurrency(diff, group?.currency)}`,
        };
      }
    }

    return { isValid: true };
  };

  const validation = getSplitValidation();

  const updateMutation = useMutation({
    mutationFn: (data) => expensesApi.update(groupId, expenseId, data),
    onSuccess: async () => {
      showToast('Expense updated successfully');
      
      // Upload new attachments if any
      if (newAttachments.length > 0) {
        showToast('Uploading new attachments...', 'info');
        for (const file of newAttachments) {
          try {
            await expensesApi.uploadAttachment(groupId, expenseId, file);
          } catch (e) {
            console.error(e);
          }
        }
      }

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

    const activeMembers = members?.filter((m) => watchParticipants[m.id]?.isIncluded) || [];

    // Construct Payers payload
    let payers = undefined;
    if (isMultiplePayers) {
      payers = Object.entries(multiplePayersData)
        .map(([memberId, amount]) => ({ memberId, amount: parseFloat(amount || 0) }))
        .filter(p => p.amount > 0);
    }

    // Construct Participants payload
    const participants = activeMembers.map((m) => {
      const pData = { memberId: m.id, isIncluded: true };
      if (watchSplitType === 'unequal') pData.shareAmount = parseFloat(watchParticipants[m.id]?.value || 0);
      if (watchSplitType === 'percentage') pData.sharePercentage = parseFloat(watchParticipants[m.id]?.value || 0);
      if (watchSplitType === 'shares') pData.shareUnits = parseFloat(watchParticipants[m.id]?.value || 1);
      return pData;
    });

    // Custom Split payloads
    const items = watchSplitType === 'item_wise'
      ? itemWiseItems.map(item => ({
          name: item.name,
          amount: parseFloat(item.amount),
          quantity: 1,
          participants: item.participants.map(memberId => ({ memberId }))
        }))
      : undefined;

    const memberDays = watchSplitType === 'days_wise'
      ? activeMembers.map(m => ({ memberId: m.id, days: parseFloat(memberDaysData[m.id] || 0) }))
      : undefined;

    const memberConsumption = watchSplitType === 'consumption_wise'
      ? activeMembers.map(m => ({ memberId: m.id, units: parseFloat(memberConsumptionData[m.id] || 0) }))
      : undefined;

    const hybridConfig = watchSplitType === 'hybrid'
      ? activeMembers.map(m => ({
          memberId: m.id,
          method: hybridConfigData[m.id]?.method || 'equal',
          value: parseFloat(hybridConfigData[m.id]?.value || 0)
        }))
      : undefined;

    updateMutation.mutate({
      title: formData.title,
      amount: parseFloat(formData.amount),
      expenseDate: formData.expenseDate,
      paidByMemberId: isMultiplePayers ? undefined : formData.paidByMemberId,
      payers,
      categoryId: formData.categoryId || null,
      splitType: watchSplitType,
      description: formData.description,
      isDraft: formData.isDraft,
      participants,
      items,
      memberDays,
      memberConsumption,
      hybridConfig,
      changeReason: changeReason || 'Modified expense details',
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
    <Box maxWidth={750}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>Edit Expense</Typography>
        <Button variant="outlined" size="small" startIcon={<HistoryRoundedIcon />} onClick={() => setHistoryOpen(true)}>
          Revision History
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!validation.isValid && watchAmount > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>{validation.message}</Alert>
      )}

      <Card>
        <CardContent sx={{ p: 3 }}>
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

              {/* Payers field */}
              <Grid size={{ xs: 12 }}>
                <FormControlLabel
                  control={<Checkbox checked={isMultiplePayers} onChange={(e) => setIsMultiplePayers(e.target.checked)} />}
                  label="Multiple Payers paid for this expense"
                />
              </Grid>

              {isMultiplePayers ? (
                <Grid size={{ xs: 12 }}>
                  <Card variant="outlined" sx={{ p: 2, bgcolor: 'rgba(139, 92, 246, 0.02)', borderColor: 'rgba(139, 92, 246, 0.12)' }}>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>Payer Breakdown</Typography>
                    {members?.map((m) => (
                      <Box key={m.id} display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
                        <Typography variant="body2">{m.full_name}</Typography>
                        <TextField
                          size="small"
                          type="number"
                          label={`Amount Paid (${group?.currency})`}
                          value={multiplePayersData[m.id] || ''}
                          onChange={(e) => setMultiplePayersData({ ...multiplePayersData, [m.id]: e.target.value })}
                          sx={{ width: 200 }}
                        />
                      </Box>
                    ))}
                  </Card>
                </Grid>
              ) : (
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField fullWidth select label="Paid by" required {...register('paidByMemberId')}>
                    {members?.map((m) => (
                      <MenuItem key={m.id} value={m.id}>{m.full_name}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
              )}

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth select label="Category" {...register('categoryId')}>
                  <MenuItem value="">None</MenuItem>
                  {categories?.map((c) => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField fullWidth select label="Split Method" {...register('splitType')}>
                  {EXTENDED_SPLIT_TYPES.map((s) => (
                    <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <TextField fullWidth label="Description" multiline rows={2} {...register('description')} />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <FormControlLabel
                  control={
                    <Controller
                      name="isDraft"
                      control={control}
                      render={({ field }) => (
                        <Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                      )}
                    />
                  }
                  label="Save as Draft (Ledger/balances won't update until published)"
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Reason for Change"
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="e.g. Corrected typo in receipt amount"
                  helperText="This description will be saved in the version history timeline."
                />
              </Grid>
            </Grid>

            {/* Existing Attachments Display */}
            {existingAttachments.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>Current Attachments</Typography>
                <Grid container spacing={1}>
                  {existingAttachments.map((file) => (
                    <Grid key={file.id} size={{ xs: 12, sm: 6 }}>
                      <Card variant="outlined" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1 }}>
                        <Typography variant="body2" noWrap sx={{ maxWidth: '80%', pl: 1 }}>
                          {file.file_name}
                        </Typography>
                        <IconButton
                          color="error"
                          onClick={() => deleteExistingAttachmentMutation.mutate(file.id)}
                          disabled={deleteExistingAttachmentMutation.isPending}
                        >
                          <CloseIcon size="small" />
                        </IconButton>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}

            {/* Add New Attachments Dropzone */}
            <Divider sx={{ my: 3 }} />
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>Upload New Attachments</Typography>
            <Box
              {...getRootProps()}
              sx={{
                border: '2px dashed rgba(139, 92, 246, 0.25)',
                borderRadius: 2,
                p: 3,
                textAlign: 'center',
                cursor: 'pointer',
                bgcolor: 'rgba(139, 92, 246, 0.02)',
                transition: 'all 0.2s ease',
                '&:hover': { bgcolor: 'rgba(139, 92, 246, 0.06)', borderColor: '#818cf8' }
              }}
            >
              <input {...getInputProps()} />
              <CloudUploadIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Drag and drop receipts or bills here, or click to upload
              </Typography>
            </Box>

            {newAttachments.length > 0 && (
              <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
                {newAttachments.map((file, idx) => (
                  <Chip
                    key={idx}
                    label={file.name}
                    onDelete={() => removeNewAttachment(idx)}
                    deleteIcon={<CloseIcon />}
                  />
                ))}
              </Stack>
            )}

            {/* Split Breakdown */}
            <Divider sx={{ my: 3 }} />
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>Split Breakdown</Typography>

            <Grid container spacing={2}>
              {watchSplitType === 'item_wise' ? (
                <Grid size={{ xs: 12 }}>
                  <Box sx={{ p: 2, bgcolor: 'rgba(139, 92, 246, 0.03)', borderRadius: 2, border: '1px solid rgba(139, 92, 246, 0.15)', mb: 3 }}>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>Items in Receipt</Typography>
                    {itemWiseItems.map((item, idx) => (
                      <Box key={item.id} sx={{ display: 'flex', gap: 1.5, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                        <TextField
                          size="small"
                          label="Item Name"
                          value={item.name}
                          onChange={(e) => {
                            const newItems = [...itemWiseItems];
                            newItems[idx].name = e.target.value;
                            setItemWiseItems(newItems);
                          }}
                          sx={{ flex: 2, minWidth: 150 }}
                        />
                        <TextField
                          size="small"
                          label="Amount"
                          type="number"
                          value={item.amount}
                          onChange={(e) => {
                            const newItems = [...itemWiseItems];
                            newItems[idx].amount = e.target.value;
                            setItemWiseItems(newItems);
                          }}
                          sx={{ flex: 1, minWidth: 100 }}
                        />
                        <FormControl size="small" sx={{ flex: 2, minWidth: 200 }}>
                          <InputLabel>Shared By</InputLabel>
                          <Select
                            multiple
                            value={item.participants}
                            label="Shared By"
                            onChange={(e) => {
                              const newItems = [...itemWiseItems];
                              newItems[idx].participants = e.target.value;
                              setItemWiseItems(newItems);
                            }}
                            renderValue={(selected) => (
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {selected.map((val) => (
                                  <Chip
                                    key={val}
                                    label={members?.find(m => m.id === val)?.full_name || val}
                                    size="small"
                                  />
                                ))}
                              </Box>
                            )}
                          >
                            {members?.map((m) => (
                              <MenuItem key={m.id} value={m.id}>{m.full_name}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <IconButton
                          color="error"
                          onClick={() => setItemWiseItems(itemWiseItems.filter((_, i) => i !== idx))}
                          disabled={itemWiseItems.length === 1}
                        >
                          <DeleteRoundedIcon />
                        </IconButton>
                      </Box>
                    ))}
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<AddRoundedIcon />}
                      onClick={() => setItemWiseItems([...itemWiseItems, { id: Date.now().toString(), name: '', amount: '', participants: [] }])}
                    >
                      Add Item
                    </Button>
                  </Box>
                </Grid>
              ) : (
                members?.map((m) => {
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

                        {isIncluded && watchSplitType === 'unequal' && (
                          <Controller
                            name={`participants.${m.id}.value`}
                            control={control}
                            render={({ field }) => (
                              <TextField
                                size="small"
                                type="number"
                                label={`Amount (${group?.currency})`}
                                required
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value)}
                                sx={{ width: 160 }}
                              />
                            )}
                          />
                        )}

                        {isIncluded && watchSplitType === 'percentage' && (
                          <Controller
                            name={`participants.${m.id}.value`}
                            control={control}
                            render={({ field }) => (
                              <TextField
                                size="small"
                                type="number"
                                label="Percent (%)"
                                required
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value)}
                                sx={{ width: 160 }}
                              />
                            )}
                          />
                        )}

                        {isIncluded && watchSplitType === 'shares' && (
                          <Controller
                            name={`participants.${m.id}.value`}
                            control={control}
                            render={({ field }) => (
                              <TextField
                                size="small"
                                type="number"
                                label="Shares"
                                required
                                value={field.value ?? '1'}
                                onChange={(e) => field.onChange(e.target.value)}
                                sx={{ width: 160 }}
                              />
                            )}
                          />
                        )}

                        {isIncluded && watchSplitType === 'days_wise' && (
                          <TextField
                            size="small"
                            type="number"
                            label="Days"
                            required
                            value={memberDaysData[m.id] || ''}
                            onChange={(e) => setMemberDaysData({ ...memberDaysData, [m.id]: e.target.value })}
                            sx={{ width: 160 }}
                          />
                        )}

                        {isIncluded && watchSplitType === 'consumption_wise' && (
                          <TextField
                            size="small"
                            type="number"
                            label="Units Consumed"
                            required
                            value={memberConsumptionData[m.id] || ''}
                            onChange={(e) => setMemberConsumptionData({ ...memberConsumptionData, [m.id]: e.target.value })}
                            sx={{ width: 160 }}
                          />
                        )}

                        {isIncluded && watchSplitType === 'hybrid' && (
                          <Box display="flex" gap={1}>
                            <FormControl size="small" sx={{ width: 110 }}>
                              <Select
                                value={hybridConfigData[m.id]?.method || 'equal'}
                                onChange={(e) => setHybridConfigData({
                                  ...hybridConfigData,
                                  [m.id]: { ...hybridConfigData[m.id], method: e.target.value }
                                })}
                              >
                                <MenuItem value="equal">Equal</MenuItem>
                                <MenuItem value="fixed">Fixed</MenuItem>
                                <MenuItem value="percentage">Percent</MenuItem>
                              </Select>
                            </FormControl>
                            {hybridConfigData[m.id]?.method !== 'equal' && (
                              <TextField
                                size="small"
                                type="number"
                                label={hybridConfigData[m.id]?.method === 'fixed' ? `Value (${group?.currency})` : 'Value (%)'}
                                required
                                value={hybridConfigData[m.id]?.value || ''}
                                onChange={(e) => setHybridConfigData({
                                  ...hybridConfigData,
                                  [m.id]: { ...hybridConfigData[m.id], value: e.target.value }
                                })}
                                sx={{ width: 100 }}
                              />
                            )}
                          </Box>
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

            {/* Live split preview container for items */}
            {watchSplitType === 'item_wise' && (
              <Box mt={2}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Calculated Shares:</Typography>
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
              </Box>
            )}

            <Box display="flex" gap={2} mt={4}>
              <Button variant="outlined" onClick={() => navigate(`/groups/${groupId}/expenses`)}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={isSubmitting || !validation.isValid}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Revision History Dialog (Loads snapshots + diffs) */}
      <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Revision History Timeline</DialogTitle>
        <DialogContent dividers>
          {historyLoading ? (
            <Skeleton variant="rectangular" height={250} />
          ) : revisions.length === 0 ? (
            <Typography color="text.secondary">No version history snapshot has been recorded yet.</Typography>
          ) : (
            <Box sx={{ position: 'relative', pl: 2, '&::before': { content: '""', position: 'absolute', left: 8, top: 10, bottom: 0, width: 2, bgcolor: 'divider' } }}>
              {revisions.map((rev) => (
                <Box key={rev.id} sx={{ position: 'relative', mb: 4, pl: 3 }}>
                  <Box sx={{ position: 'absolute', left: -9, top: 4, width: 12, height: 12, borderRadius: '50%', bgcolor: 'secondary.main', border: '2px solid', borderColor: 'background.paper' }} />
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>
                    Version #{rev.revision_number} • {new Date(rev.created_at).toLocaleString()}
                  </Typography>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 0.5 }}>
                    Modified by: {rev.changer_name || 'System User'}
                  </Typography>
                  <Typography variant="body2" color="primary.main" fontWeight={600} sx={{ fontStyle: 'italic', my: 0.5 }}>
                    Reason: "{rev.change_reason || 'No description provided'}"
                  </Typography>

                  {/* Render Diffs */}
                  {rev.diff && Object.keys(rev.diff).length > 0 && (
                    <Box sx={{ mt: 1, p: 1.5, bgcolor: 'rgba(0, 0, 0, 0.25)', borderRadius: 1.5, border: '1px solid rgba(139, 92, 246, 0.15)', fontSize: '0.8rem', color: '#94a3b8' }}>
                      <Typography variant="caption" fontWeight={700} display="block" color="text.secondary" sx={{ mb: 0.5 }}>
                        Changes:
                      </Typography>
                      {Object.entries(rev.diff).map(([key, val]) => {
                        const formatDiffVal = (v) => {
                          if (v === null) return 'null';
                          if (v === undefined) return 'undefined';
                          if (typeof v === 'boolean') return v ? 'true' : 'false';
                          if (typeof v === 'object') return JSON.stringify(v);
                          return String(v);
                        };
                        return (
                          <Box key={key} sx={{ mb: 0.5 }}>
                            <span style={{ fontWeight: 600, color: '#c084fc' }}>{key}</span>: was{' '}
                            <span style={{ color: '#f87171', textDecoration: 'line-through', padding: '1px 4px', background: 'rgba(248, 113, 113, 0.1)', borderRadius: 4 }}>{formatDiffVal(val.before)}</span>
                            {' '}👉{' '}
                            <span style={{ color: '#34d399', fontWeight: 600, padding: '1px 4px', background: 'rgba(52, 211, 153, 0.1)', borderRadius: 4 }}>{formatDiffVal(val.after)}</span>
                          </Box>
                        );
                      })}
                    </Box>
                  )}
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
