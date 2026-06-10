import { useState } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import {
  Box, Typography, Grid2 as Grid, Card, CardContent, Button, List, ListItem,
  ListItemText, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Alert, Chip, Tabs, Tab, Stack, IconButton, Tooltip,
  Menu,
} from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settlementsApi } from '../../services/api.js';
import { formatCurrency, formatDate } from '../../utils/formatters.js';
import { getErrorMessage } from '../../services/api-client.js';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import { exportToExcel, exportToPDF, generateBalancesExportData } from '../../utils/exportEngine.js';

export default function SettlementPage() {
  const { groupId } = useParams();
  const { group } = useOutletContext();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(0);
  const [settleDialog, setSettleDialog] = useState(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const handleOpenSettleDialog = (s) => {
    setSettleDialog(s);
    setSettleAmount(s.amount.toString());
  };

  const { data: suggestions } = useQuery({
    queryKey: ['suggestions', groupId],
    queryFn: async () => {
      const { data } = await settlementsApi.getSuggestions(groupId);
      return data.data;
    },
  });

  const { data: settlementsData } = useQuery({
    queryKey: ['settlements', groupId],
    queryFn: async () => {
      const { data } = await settlementsApi.list(groupId, { limit: 20 });
      return data;
    },
  });

  const { data: balances } = useQuery({
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

  const settleMutation = useMutation({
    mutationFn: (data) => settlementsApi.create(groupId, data),
    onSuccess: () => {
      invalidateAll();
      setSettleDialog(null);
      setNotes('');
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const cancelMutation = useMutation({
    mutationFn: (settlementId) => settlementsApi.cancel(groupId, settlementId),
    onSuccess: () => invalidateAll(),
    onError: (err) => setError(getErrorMessage(err)),
  });

  const handleSettle = (suggestion) => {
    setError('');
    const amt = parseFloat(settleAmount);
    if (isNaN(amt) || amt <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }
    settleMutation.mutate({
      fromMemberId: suggestion.fromMemberId,
      toMemberId: suggestion.toMemberId,
      amount: amt,
      method,
      notes,
      status: 'completed',
      isSuggested: true,
    });
  };

  const settlements = settlementsData?.data || [];

  return (
    <Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Suggestions" />
        <Tab label="History" />
        <Tab label="Balances" />
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
              {suggestions?.map((s, i) => (
                <Grid size={{ xs: 12, sm: 6 }} key={i}>
                  <Card sx={{ animation: `fadeInUp 0.3s ease ${i * 0.05}s both` }}>
                    <CardContent>
                      <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
                        <Typography fontWeight={600}>{s.fromName}</Typography>
                        <ArrowForwardRoundedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                        <Typography fontWeight={600}>{s.toName}</Typography>
                      </Stack>
                      <Typography variant="h4" fontWeight={800} className="gradient-text" gutterBottom>
                        {formatCurrency(s.amount, group?.currency)}
                      </Typography>
                      <Button variant="contained" size="small" onClick={() => handleOpenSettleDialog(s)} startIcon={<HandshakeRoundedIcon />}>
                        Record Payment
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {/* History Tab */}
      {tab === 1 && (
        <Card>
          <List disablePadding>
            {settlements.length === 0 ? (
              <ListItem sx={{ py: 4, justifyContent: 'center' }}>
                <Typography color="text.secondary">No settlements recorded yet</Typography>
              </ListItem>
            ) : settlements.map((s, i) => (
              <ListItem
                key={s.id}
                divider={i < settlements.length - 1}
                sx={{ py: 2 }}
                secondaryAction={
                  s.status === 'completed' && (
                    <Tooltip title="Cancel Settlement">
                      <IconButton size="small" onClick={() => cancelMutation.mutate(s.id)} sx={{ color: 'error.main' }}>
                        <CancelRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
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
                  secondary={`${formatDate(s.settled_at || s.created_at)} · ${s.method?.replace('_', ' ') || 'N/A'}`}
                />
                <Box textAlign="right" sx={{ mr: 4 }}>
                  <Typography fontWeight={700}>{formatCurrency(s.amount, group?.currency)}</Typography>
                  <Chip
                    label={s.status}
                    size="small"
                    color={s.status === 'completed' ? 'success' : s.status === 'cancelled' ? 'error' : 'default'}
                  />
                </Box>
              </ListItem>
            ))}
          </List>
        </Card>
      )}

      {/* Balances Tab */}
      {tab === 2 && (
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
              </Menu>
            </Box>
          </Box>
          <Grid container spacing={2}>
            {balances?.map((b, i) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={b.member_id}>
              <Card sx={{ animation: `fadeInUp 0.3s ease ${i * 0.05}s both` }}>
                <CardContent>
                  <Typography fontWeight={600} gutterBottom>{b.full_name}</Typography>
                  <Typography
                    variant="h5"
                    fontWeight={700}
                    color={parseFloat(b.balance) > 0 ? 'error.main' : parseFloat(b.balance) < 0 ? 'success.main' : 'text.secondary'}
                  >
                    {parseFloat(b.balance) > 0 ? 'owes ' : parseFloat(b.balance) < 0 ? 'gets back ' : ''}
                    {formatCurrency(Math.abs(b.balance), group?.currency)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
          </Grid>
        </Box>
      )}

      {/* Settle Dialog */}
      <Dialog open={!!settleDialog} onClose={() => setSettleDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Record Settlement</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {settleDialog && (
            <Box sx={{ p: 2, mb: 2, borderRadius: 2, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(139,92,246,0.1)' }}>
              <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                <Typography fontWeight={600}>{settleDialog.fromName}</Typography>
                <ArrowForwardRoundedIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                <Typography fontWeight={600}>{settleDialog.toName}</Typography>
              </Stack>
              <Typography variant="h5" fontWeight={800} className="gradient-text" gutterBottom>
                {formatCurrency(settleDialog.amount, group?.currency)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Suggested optimal transaction amount
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
            onChange={(e) => setSettleAmount(e.target.value)}
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
          <Button variant="contained" disabled={settleMutation.isPending} onClick={() => handleSettle(settleDialog)}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
