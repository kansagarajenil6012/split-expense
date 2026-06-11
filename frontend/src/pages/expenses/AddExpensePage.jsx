import { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import {
  Box, Typography, TextField, Button, Card, CardContent, Grid2 as Grid,
  MenuItem, FormControlLabel, Checkbox, Alert, Divider, IconButton,
  Stack, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  Chip, List, ListItem, ListItemText, ListItemSecondaryAction, Select, FormControl, InputLabel
} from '@mui/material';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloseIcon from '@mui/icons-material/Close';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { expensesApi, groupsApi, eventsApi, corporateApi } from '../../services/api.js';
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

  // Attachments state
  const [attachments, setAttachments] = useState([]);
  
  // Duplicate check warning state
  const [duplicateWarningOpen, setDuplicateWarningOpen] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState(null);

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

  // Initialize helpers on members load
  useEffect(() => {
    if (members) {
      const initialParticipants = {};
      const initialDays = {};
      const initialConsumption = {};
      const initialHybrid = {};
      const initialPayers = {};

      members.forEach((m) => {
        initialParticipants[m.id] = { isIncluded: true, value: '' };
        initialDays[m.id] = 1;
        initialConsumption[m.id] = 1;
        initialHybrid[m.id] = { method: 'equal', value: '' };
        initialPayers[m.id] = '';
      });

      setMemberDaysData(initialDays);
      setMemberConsumptionData(initialConsumption);
      setHybridConfigData(initialHybrid);
      setMultiplePayersData(initialPayers);

      reset({
        title: '',
        amount: '',
        expenseDate: dayjs().format('YYYY-MM-DD'),
        paidByMemberId: members[0]?.id || '',
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

  // Dropzone config for files
  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'image/*': [],
      'application/pdf': []
    },
    maxFiles: 5,
    onDrop: (acceptedFiles) => {
      setAttachments([...attachments, ...acceptedFiles].slice(0, 5));
    }
  });

  const removeAttachment = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  // Live Preview calculation
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

    if (watchSplitType === 'hybrid') {
      const activeConfigs = activeMembers.map(m => ({
        method: hybridConfigData[m.id]?.method || 'equal',
        value: parseFloat(hybridConfigData[m.id]?.value || 0),
      }));
      const fixedTotal = activeConfigs.filter(c => c.method === 'fixed').reduce((s, c) => s + c.value, 0);
      const pctTotal = activeConfigs.filter(c => c.method === 'percentage').reduce((s, c) => s + c.value, 0);

      if (fixedTotal > watchAmount) {
        return { isValid: false, message: `Fixed amounts (${formatCurrency(fixedTotal, group?.currency)}) exceed total expense amount.` };
      }
      if (pctTotal > 100) {
        return { isValid: false, message: `Percentages (${pctTotal}%) exceed 100%.` };
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

  const createMutation = useMutation({
    mutationFn: (data) => expensesApi.create(groupId, data),
    onSuccess: async (res) => {
      // If backend returns a duplicate warning (intercepted success)
      if (res.data?.duplicateWarning) {
        setPendingSubmitData(res.config.data);
        setDuplicateWarningOpen(true);
        return;
      }

      const createdExpense = res.data.data;
      showToast('Expense created successfully');

      // Upload attachments if any
      if (attachments.length > 0) {
        showToast('Uploading attachments...', 'info');
        for (const file of attachments) {
          try {
            await expensesApi.uploadAttachment(groupId, createdExpense.id, file);
          } catch (e) {
            console.error('Attachment upload failed', e);
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
      queryClient.invalidateQueries({ queryKey: ['balances', groupId] });
      navigate(`/groups/${groupId}/expenses`);
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const handleCreateSubmit = (formData, isDraft = false) => {
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

    // Custom Split details payloads
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

    createMutation.mutate({
      title: formData.title,
      amount: parseFloat(formData.amount),
      expenseDate: formData.expenseDate,
      paidByMemberId: isMultiplePayers ? undefined : formData.paidByMemberId,
      payers,
      categoryId: formData.categoryId || null,
      eventId: formData.eventId || null,
      costCenterId: formData.costCenterId || null,
      projectName: formData.projectName || null,
      approvalStatus: formData.approvalStatus || 'approved',
      splitType: watchSplitType,
      description: formData.description,
      isDraft,
      participants,
      items,
      memberDays,
      memberConsumption,
      hybridConfig,
    });
  };

  const forceSubmit = async () => {
    setDuplicateWarningOpen(false);
    if (!pendingSubmitData) return;

    try {
      const parsedData = JSON.parse(pendingSubmitData);
      parsedData.skipDuplicateCheck = true;
      
      const res = await expensesApi.create(groupId, parsedData);
      showToast('Expense created successfully');

      const createdExpense = res.data.data;
      if (attachments.length > 0) {
        for (const file of attachments) {
          await expensesApi.uploadAttachment(groupId, createdExpense.id, file);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
      queryClient.invalidateQueries({ queryKey: ['balances', groupId] });
      navigate(`/groups/${groupId}/expenses`);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <Box maxWidth={750}>
      <Typography variant="h5" fontWeight={700} gutterBottom>Add Expense</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!validation.isValid && watchAmount > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>{validation.message}</Alert>
      )}

      <Card>
        <CardContent sx={{ p: 3 }}>
          <Box component="form">
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

            {/* Attachments Dropzone */}
            <Divider sx={{ my: 3 }} />
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>Attachments</Typography>
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
              <Typography variant="caption" color="text.secondary">
                Upload up to 5 images or PDFs (max 10MB per file)
              </Typography>
            </Box>

            {attachments.length > 0 && (
              <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
                {attachments.map((file, idx) => (
                  <Chip
                    key={idx}
                    label={file.name}
                    onDelete={() => removeAttachment(idx)}
                    deleteIcon={<CloseIcon />}
                  />
                ))}
              </Stack>
            )}

            {/* Split Breakdown */}
            <Divider sx={{ my: 3 }} />
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>Split Breakdown</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Choose who is included and configure how much they pay.
            </Typography>

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
                            label="Consumption Units"
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

            <Box display="flex" gap={2} mt={4} sx={{ width: '100%' }}>
              <Button variant="outlined" onClick={() => navigate(`/groups/${groupId}/expenses`)}>Cancel</Button>
              <Button
                variant="outlined"
                color="secondary"
                disabled={isSubmitting || !validation.isValid}
                onClick={handleSubmit((data) => handleCreateSubmit(data, true))}
              >
                Save as Draft
              </Button>
              <Button
                type="button"
                variant="contained"
                disabled={isSubmitting || !validation.isValid}
                onClick={handleSubmit((data) => handleCreateSubmit(data, false))}
              >
                {isSubmitting ? 'Saving...' : 'Add Expense'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Duplicate Warning Dialog */}
      <Dialog open={duplicateWarningOpen} onClose={() => setDuplicateWarningOpen(false)}>
        <DialogTitle>Duplicate Expense Detected</DialogTitle>
        <DialogContent>
          <DialogContentText>
            An expense with the same title, amount, and date already exists in this group. Are you sure you want to add this expense anyway?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDuplicateWarningOpen(false)}>Cancel</Button>
          <Button onClick={forceSubmit} variant="contained" color="warning">
            Save Anyway
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
