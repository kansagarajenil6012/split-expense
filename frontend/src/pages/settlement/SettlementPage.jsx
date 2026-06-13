import { useState } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import {
  Box, Typography, Grid2 as Grid, Card, CardContent, Button, List, ListItem,
  ListItemText, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Alert, Chip, Tabs, Tab, Stack, IconButton, Tooltip,
  Menu, Checkbox, FormControlLabel, CircularProgress
} from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settlementsApi } from '../../services/api.js';
import { formatCurrency, formatDate } from '../../utils/formatters.js';
import { getErrorMessage } from '../../services/api-client.js';
import { useAuthStore } from '../../store/auth.store.js';
import { useUIStore } from '../../store/ui.store.js';
import { exportToExcel, exportToPDF, exportToCSV, generateBalancesExportData } from '../../utils/exportEngine.js';
import LedgerTab from './LedgerTab.jsx';

export default function SettlementPage() {
  const { groupId } = useParams();
  const { group } = useOutletContext();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);

  const [tab, setTab] = useState(0);
  
  // Dialog states
  const [settleDialog, setSettleDialog] = useState(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [isPartial, setIsPartial] = useState(false);
  const [isRequestOnly, setIsRequestOnly] = useState(false);

  // Reversal state
  const [reversalDialog, setReversalDialog] = useState(null);
  const [reversalReason, setReversalReason] = useState('');

  // Reminder state
  const [reminderDialog, setReminderDialog] = useState(null);
  const [reminderMessage, setReminderMessage] = useState('');

  const [error, setError] = useState('');

  const handleOpenSettleDialog = (s, isReq = false) => {
    setSettleDialog(s);
    setSettleAmount(s.amount.toString());
    setIsRequestOnly(isReq);
    setIsPartial(false);
  };

  const handleOpenReminderDialog = (s) => {
    setReminderDialog(s);
    setReminderMessage(`Friendly reminder to settle outstanding balance of ${formatCurrency(s.amount, group?.currency)}.`);
  };

  const { data: suggestions, isLoading: isLoadingSuggestions } = useQuery({
    queryKey: ['suggestions', groupId],
    queryFn: async () => {
      const { data } = await settlementsApi.getSuggestions(groupId);
      return data.data;
    },
  });

  const { data: settlementsData, isLoading: isLoadingSettlements } = useQuery({
    queryKey: ['settlements', groupId],
    queryFn: async () => {
      const { data } = await settlementsApi.list(groupId, { limit: 100 });
      return data;
    },
  });

  const { data: balances, isLoading: isLoadingBalances } = useQuery({
    queryKey: ['balances', groupId],
    queryFn: async () => {
      const { data } = await settlementsApi.getBalances(groupId);
      return data.data;
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['suggestions', groupId] });
    queryClient.invalidateQueries({ queryKey: ['balances', groupId] });
    queryClient.invalidateQueries({ queryKey: ['settlements', groupId] });
  };

  const [exportAnchorEl, setExportAnchorEl] = useState(null);
  const handleExportClick = (e) => setExportAnchorEl(e.currentTarget);
  const handleExportClose = () => setExportAnchorEl(null);

  const handleExportExcel = () => {
    handleExportClose();
    if (!balances || balances.length === 0) return;
    const data = generateBalancesExportData(balances);
    exportToExcel(data, `Balances_${group?.name || 'Group'}_${formatDate(new Date())}`);
  };

  const handleExportPDF = () => {
    handleExportClose();
    if (!balances || balances.length === 0) return;
    const data = generateBalancesExportData(balances);
    const headers = ['Member Name', 'Status', 'Net Balance'];
    const rows = data.map(d => [d['Member Name'], d['Status'], d['Net Balance']]);
    exportToPDF(headers, rows, `Balances_${group?.name || 'Group'}`, `${group?.name} - Member Balances`);
  };

  const handleExportCSV = () => {
    handleExportClose();
    if (!balances || balances.length === 0) return;
    const data = generateBalancesExportData(balances);
    exportToCSV(data, `Balances_${group?.name || 'Group'}_${formatDate(new Date())}`);
  };

  // Mutations
  const settleMutation = useMutation({
    mutationFn: (data) => settlementsApi.create(groupId, data),
    onSuccess: () => {
      invalidateAll();
      setSettleDialog(null);
      setNotes('');
      showToast('Settlement recorded successfully');
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const requestMutation = useMutation({
    mutationFn: (data) => settlementsApi.request(groupId, data),
    onSuccess: () => {
      invalidateAll();
      setSettleDialog(null);
      setNotes('');
      showToast('Settlement approval request sent');
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const approveMutation = useMutation({
    mutationFn: (id) => settlementsApi.approve(groupId, id),
    onSuccess: () => {
      invalidateAll();
      showToast('Settlement approved');
    },
    onError: (err) => showToast(getErrorMessage(err), 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id) => settlementsApi.reject(groupId, id),
    onSuccess: () => {
      invalidateAll();
      showToast('Settlement rejected');
    },
    onError: (err) => showToast(getErrorMessage(err), 'error'),
  });

  const reverseMutation = useMutation({
    mutationFn: ({ id, data }) => settlementsApi.reverse(groupId, id, data),
    onSuccess: () => {
      invalidateAll();
      setReversalDialog(null);
      setReversalReason('');
      showToast('Settlement reversed successfully', 'info');
    },
    onError: (err) => showToast(getErrorMessage(err), 'error'),
  });

  const remindMutation = useMutation({
    mutationFn: (data) => settlementsApi.remind(groupId, data),
    onSuccess: () => {
      setReminderDialog(null);
      showToast('Reminder notification sent successfully');
    },
    onError: (err) => showToast(getErrorMessage(err), 'error'),
  });

  const cancelMutation = useMutation({
    mutationFn: (settlementId) => settlementsApi.cancel(groupId, settlementId),
    onSuccess: () => {
      invalidateAll();
      showToast('Settlement voided successfully');
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const handleSettleSubmit = (suggestion) => {
    setError('');
    const amt = parseFloat(settleAmount);
    if (isNaN(amt) || amt <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }

    const payload = {
      fromMemberId: suggestion.fromMemberId,
      toMemberId: suggestion.toMemberId,
      amount: amt,
      method,
      notes,
      isSuggested: true,
      isPartial,
    };

    if (isRequestOnly) {
      requestMutation.mutate(payload);
    } else {
      settleMutation.mutate({ ...payload, status: 'completed' });
    }
  };

  const handleReverseSubmit = () => {
    if (!reversalReason.trim()) return;
    reverseMutation.mutate({
      id: reversalDialog.id,
      data: { reason: reversalReason }
    });
  };

  const handleReminderSubmit = () => {
    remindMutation.mutate({
      toMemberId: reminderDialog.fromMemberId, // The person who owes the money (fromMember in suggestion)
      amount: reminderDialog.amount,
      message: reminderMessage,
    });
  };

  const settlements = settlementsData?.data || [];
  
  // Group membership shortcut
  const myMembershipId = group?.myMembership?.id;

  // Filter requested/pending approvals
  const pendingRequests = settlements.filter(s => s.status === 'requested');
  const completedSettlements = settlements.filter(s => s.status !== 'requested');

  if (isLoadingSuggestions || isLoadingSettlements || isLoadingBalances) {
    return (
      <Box sx={{ p: 8, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Suggestions" />
        <Tab label={`Pending Approval (${pendingRequests.length})`} />
        <Tab label="History" />
        <Tab label="Balances" />
        <Tab label="Statement" />
      </Tabs>

      {/* Suggestions Tab */}
      {tab === 0 && (
        <Box>
          <Typography color="text.secondary" gutterBottom>
            Optimized settlement plan — minimum transactions to settle all debts
          </Typography>
          {suggestions?.length === 0 ? (
            <Card sx={{ p: 5, textAlign: 'center', mt: 2 }}>
              <CheckCircleRoundedIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography variant="h6" fontWeight={600}>Everyone is settled up! 🎉</Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>No pending debts in this group</Typography>
            </Card>
          ) : (
            <Grid container spacing={2} mt={1}>
              {suggestions?.map((s, i) => {
                const isCreditorMe = s.toMemberId === myMembershipId;
                const isDebtorMe = s.fromMemberId === myMembershipId;
                return (
                  <Grid size={{ xs: 12, sm: 6 }} key={i}>
                    <Card sx={{ animation: `fadeInUp 0.3s ease ${i * 0.05}s both` }}>
                      <CardContent>
                        <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
                          <Typography fontWeight={600}>{s.fromName}</Typography>
                          <ArrowForwardRoundedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                          <Typography fontWeight={600}>{s.toName}</Typography>
                        </Stack>
                        <Typography variant="h4" fontWeight={800} color="primary.main" gutterBottom>
                          {formatCurrency(s.amount, group?.currency)}
                        </Typography>
                        
                        <Stack direction="row" spacing={1}>
                          {isDebtorMe && (
                            <>
                              <Button
                                variant="contained"
                                size="small"
                                onClick={() => handleOpenSettleDialog(s, false)}
                                startIcon={<HandshakeRoundedIcon />}
                                disabled={group?.is_archived}
                              >
                                Record Cash Payment
                              </Button>
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={() => handleOpenSettleDialog(s, true)}
                                disabled={group?.is_archived}
                              >
                                Request Settle Approval
                              </Button>
                            </>
                          )}
                          {isCreditorMe && (
                            <>
                              <Button
                                variant="contained"
                                color="success"
                                size="small"
                                onClick={() => handleOpenSettleDialog(s, false)}
                                startIcon={<CheckCircleRoundedIcon />}
                                disabled={group?.is_archived}
                              >
                                Mark as Received
                              </Button>
                              <Button
                                variant="outlined"
                                color="secondary"
                                size="small"
                                onClick={() => handleOpenReminderDialog(s)}
                                startIcon={<NotificationsActiveRoundedIcon />}
                                disabled={group?.is_archived}
                              >
                                Send Reminder
                              </Button>
                            </>
                          )}
                          {!isDebtorMe && !isCreditorMe && (
                            <Button
                              variant="contained"
                              size="small"
                              onClick={() => handleOpenSettleDialog(s, false)}
                              startIcon={<HandshakeRoundedIcon />}
                              disabled={group?.is_archived}
                            >
                              Record Payment
                            </Button>
                          )}
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </Box>
      )}

      {/* Pending Approvals Tab */}
      {tab === 1 && (
        <Box>
          <Typography color="text.secondary" gutterBottom sx={{ mb: 2 }}>
            Settlements awaiting validation or confirmation from counterparties
          </Typography>
          
          <Card>
            <List disablePadding>
              {pendingRequests.length === 0 ? (
                <ListItem sx={{ py: 4, justifyContent: 'center' }}>
                  <Typography color="text.secondary">No pending settlement requests</Typography>
                </ListItem>
              ) : pendingRequests.map((s) => {
                const isIncoming = s.to_member_id === myMembershipId;
                return (
                  <ListItem
                    key={s.id}
                    sx={{ py: 2, borderBottom: '1px solid #eee' }}
                    secondaryAction={
                      isIncoming ? (
                        <Stack direction="row" spacing={1}>
                          <Button
                            variant="contained"
                            color="success"
                            size="small"
                            onClick={() => approveMutation.mutate(s.id)}
                            disabled={approveMutation.isPending || group?.is_archived}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            onClick={() => rejectMutation.mutate(s.id)}
                            disabled={rejectMutation.isPending || group?.is_archived}
                          >
                            Reject
                          </Button>
                        </Stack>
                      ) : (
                        <Chip label="Awaiting Approval" color="warning" variant="outlined" size="small" />
                      )
                    }
                  >
                    <ListItemText
                      primary={
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography fontWeight={500}>{s.from_name}</Typography>
                          <ArrowForwardRoundedIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                          <Typography fontWeight={500}>{s.to_name}</Typography>
                        </Stack>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          {`Requested on ${formatDate(s.created_at)} · via ${s.method?.toUpperCase()} ${s.notes ? `· Notes: "${s.notes}"` : ''}`}
                        </Typography>
                      }
                    />
                    <Typography fontWeight={700} sx={{ mr: 4 }}>
                      {formatCurrency(s.amount, group?.currency)}
                    </Typography>
                  </ListItem>
                );
              })}
            </List>
          </Card>
        </Box>
      )}

      {/* History Tab */}
      {tab === 2 && (
        <Card>
          <List disablePadding>
            {completedSettlements.length === 0 ? (
              <ListItem sx={{ py: 4, justifyContent: 'center' }}>
                <Typography color="text.secondary">No settlement history found</Typography>
              </ListItem>
            ) : completedSettlements.map((s, i) => (
              <ListItem
                key={s.id}
                divider={i < completedSettlements.length - 1}
                sx={{ py: 2 }}
                secondaryAction={
                  s.status === 'completed' ? (
                    <Stack direction="row" spacing={1}>
                      <Tooltip title="Reverse Settlement">
                        <IconButton
                          size="small"
                          onClick={() => setReversalDialog(s)}
                          sx={{ color: 'warning.main' }}
                          disabled={group?.is_archived}
                        >
                          <UndoRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Void / Cancel">
                        <IconButton
                          size="small"
                          onClick={() => cancelMutation.mutate(s.id)}
                          sx={{ color: 'error.main' }}
                          disabled={group?.is_archived}
                        >
                          <CancelRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  ) : null
                }
              >
                <ListItemText
                  primary={
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography fontWeight={500}>{s.from_name}</Typography>
                      <ArrowForwardRoundedIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                      <Typography fontWeight={500}>{s.to_name}</Typography>
                      {s.is_partial && <Chip label="Partial" size="small" sx={{ height: 18, fontSize: '0.6rem' }} />}
                    </Stack>
                  }
                  secondary={
                    <Stack direction="column" spacing={0.2}>
                      <Typography variant="caption" color="text.secondary">
                        {`${formatDate(s.settled_at || s.created_at)} · Payment: ${s.method?.replace('_', ' ').toUpperCase()}`}
                      </Typography>
                      {s.reversal_reason && (
                        <Typography variant="caption" color="error.main" fontWeight={600}>
                          {`Reversal Reason: "${s.reversal_reason}"`}
                        </Typography>
                      )}
                    </Stack>
                  }
                />
                <Box textAlign="right" sx={{ mr: 6 }}>
                  <Typography fontWeight={700}>{formatCurrency(s.amount, group?.currency)}</Typography>
                  <Chip
                    label={s.status}
                    size="small"
                    color={s.status === 'completed' ? 'success' : s.status === 'reversed' ? 'warning' : 'error'}
                    sx={{ textTransform: 'capitalize' }}
                  />
                </Box>
              </ListItem>
            ))}
          </List>
        </Card>
      )}

      {/* Balances Tab */}
      {tab === 3 && (
        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Current Balances</Typography>
            <Box>
              <Button variant="outlined" size="small" startIcon={<FileDownloadRoundedIcon />} onClick={handleExportClick}>
                Export
              </Button>
              <Menu anchorEl={exportAnchorEl} open={Boolean(exportAnchorEl)} onClose={handleExportClose}>
                <MenuItem onClick={handleExportExcel}>Export to Excel (.xlsx)</MenuItem>
                <MenuItem onClick={handleExportPDF}>Export to PDF (.pdf)</MenuItem>
                <MenuItem onClick={handleExportCSV}>Export to CSV (.csv)</MenuItem>
              </Menu>
            </Box>
          </Box>
          <Grid container spacing={2}>
            {balances?.map((b, i) => {
              const isDebtor = parseFloat(b.balance) > 0;
              return (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={b.member_id}>
                  <Card sx={{ animation: `fadeInUp 0.3s ease ${i * 0.05}s both` }}>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Typography fontWeight={600} gutterBottom>{b.full_name}</Typography>
                        {isDebtor && b.member_id !== myMembershipId && (
                          <Tooltip title="Send Reminder">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenReminderDialog({ fromMemberId: b.member_id, amount: parseFloat(b.balance) })}
                              sx={{ color: 'secondary.main', p: 0 }}
                              disabled={group?.is_archived}
                            >
                              <NotificationsActiveRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                      <Typography
                        variant="h5"
                        fontWeight={700}
                        color={isDebtor ? 'error.main' : parseFloat(b.balance) < 0 ? 'success.main' : 'text.secondary'}
                      >
                        {isDebtor ? 'owes ' : parseFloat(b.balance) < 0 ? 'gets back ' : ''}
                        {formatCurrency(Math.abs(b.balance), group?.currency)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      )}

      {/* Ledger Statement Tab */}
      {tab === 4 && (
        <LedgerTab groupId={groupId} currentUser={currentUser} />
      )}

      {/* Settle Dialog */}
      <Dialog open={!!settleDialog} onClose={() => setSettleDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{isRequestOnly ? 'Request Settlement Approval' : 'Record Settlement'}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {settleDialog && (
            <Box sx={{ p: 2, mb: 2, borderRadius: 2, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(139,92,246,0.1)' }}>
              <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                <Typography fontWeight={600}>{settleDialog.fromName}</Typography>
                <ArrowForwardRoundedIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                <Typography fontWeight={600}>{settleDialog.toName}</Typography>
              </Stack>
              <Typography variant="h5" fontWeight={800} color="primary.main" gutterBottom>
                {formatCurrency(settleDialog.amount, group?.currency)}
              </Typography>
            </Box>
          )}
          
          <TextField
            fullWidth
            label={`Settlement Amount (${group?.currency || 'INR'})`}
            type="number"
            margin="normal"
            required
            inputProps={{ min: 0.01, step: 0.01 }}
            value={settleAmount}
            onChange={(e) => {
              setSettleAmount(e.target.value);
              if (settleDialog && parseFloat(e.target.value) < parseFloat(settleDialog.amount)) {
                setIsPartial(true);
              } else {
                setIsPartial(false);
              }
            }}
          />

          <FormControlLabel
            control={<Checkbox checked={isPartial} onChange={(e) => setIsPartial(e.target.checked)} />}
            label="Mark as Partial Payment (Amount less than full balance)"
          />

          <TextField fullWidth select label="Payment Method" margin="normal" value={method} onChange={(e) => setMethod(e.target.value)}>
            {['cash', 'upi', 'bank_transfer', 'other'].map((m) => (
              <MenuItem key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</MenuItem>
            ))}
          </TextField>
          <TextField fullWidth label="Notes" margin="normal" multiline rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettleDialog(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={settleMutation.isPending || requestMutation.isPending}
            onClick={() => handleSettleSubmit(settleDialog)}
          >
            {isRequestOnly ? 'Submit Request' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reversal dialog */}
      <Dialog open={!!reversalDialog} onClose={() => setReversalDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Reverse Completed Settlement</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Voiding this settlement will restore the ledger debt balances for both members.
          </Typography>
          <TextField
            fullWidth
            required
            label="Reason for Reversal"
            value={reversalReason}
            onChange={(e) => setReversalReason(e.target.value)}
            placeholder="e.g. UPI transaction bounced"
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReversalDialog(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleReverseSubmit}
            disabled={reverseMutation.isPending || !reversalReason.trim()}
          >
            Reverse Payment
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reminder dialog */}
      <Dialog open={!!reminderDialog} onClose={() => setReminderDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Send Settlement Reminder</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Send an in-app alert notification to help nudge the member to settle their balance.
          </Typography>
          <TextField
            fullWidth
            label="Custom Message"
            multiline
            rows={2}
            value={reminderMessage}
            onChange={(e) => setReminderMessage(e.target.value)}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReminderDialog(null)}>Cancel</Button>
          <Button
            color="primary"
            variant="contained"
            onClick={handleReminderSubmit}
            disabled={remindMutation.isPending}
          >
            Send Reminder
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
