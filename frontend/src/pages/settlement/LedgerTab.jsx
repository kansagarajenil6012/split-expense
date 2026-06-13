import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Card, Stack, Avatar, Select, MenuItem,
  Table, TableHead, TableBody, TableRow, TableCell, Paper,
  Chip, Skeleton, CircularProgress
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { settlementsApi, groupsApi } from '../../services/api.js';
import { formatCurrency, formatDate } from '../../utils/formatters.js';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import ReceiptRoundedIcon from '@mui/icons-material/ReceiptRounded';
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';

export default function LedgerTab({ groupId, currentUser }) {
  const [selectedMemberId, setSelectedMemberId] = useState('all'); // Initialize below once members load

  // Fetch Members
  const { data: members } = useQuery({
    queryKey: ['members', groupId],
    queryFn: async () => {
      const { data } = await groupsApi.getMembers(groupId);
      return data.data;
    },
  });

  // Default to current user's membership ID if not selected
  const myMembership = members?.find(m => m.user_id === currentUser?.id);
  
  if (selectedMemberId === 'all' && myMembership) {
    setSelectedMemberId(myMembership.id);
  }

  // Fetch Ledger Entries
  const { data: ledgerData, isLoading } = useQuery({
    queryKey: ['ledger', groupId],
    queryFn: async () => {
      const { data } = await settlementsApi.getLedger(groupId, { limit: 500 });
      return data.data; 
    },
  });

  const entries = ledgerData || [];

  // Filter entries for selected member
  // The backend returns them sorted by occurred_at DESC (newest first).
  // To calculate a running balance, we need to sort ascending, calculate, then reverse.
  const processedEntries = useMemo(() => {
    if (!entries.length || !selectedMemberId) return [];
    
    // Filter by member
    const memberEntries = entries.filter(e => e.member_id === selectedMemberId);
    
    // Sort Ascending (Oldest first) to calculate running balance
    const ascending = [...memberEntries].sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at));
    
    let balance = 0;
    const withBalance = ascending.map(entry => {
      const amt = parseFloat(entry.amount);
      balance += amt;
      return { ...entry, runningBalance: balance, parsedAmount: amt };
    });
    
    // Reverse back to newest first for display
    return withBalance.reverse();
  }, [entries, selectedMemberId]);

  const selectedMember = members?.find(m => m.id === selectedMemberId);

  if (isLoading) {
    return (
      <Box sx={{ p: 4 }}>
        <Stack spacing={2} mb={4}>
          <Skeleton variant="text" width={200} height={40} />
          <Skeleton variant="text" width={400} />
        </Stack>
        <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 4, mb: 4 }} />
        <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 4 }} />
      </Box>
    );
  }

  return (
    <Box sx={{ animation: 'fadeIn 0.3s ease' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} mb={3} spacing={2}>
        <Box>
          <Typography variant="h5" fontWeight={800} color="text.primary">Statement of Account</Typography>
          <Typography variant="body2" color="text.secondary">Detailed ledger showing all transactions and running balance.</Typography>
        </Box>
        
        <Box sx={{ minWidth: 200 }}>
          <Select
            size="small"
            fullWidth
            value={selectedMemberId === 'all' ? '' : selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            displayEmpty
            sx={{ borderRadius: 2, bgcolor: 'background.paper' }}
          >
            {members?.map(m => (
              <MenuItem key={m.id} value={m.id}>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Avatar src={m.avatar_url} sx={{ width: 24, height: 24 }}>{m.full_name[0]}</Avatar>
                  <Typography>{m.full_name} {m.user_id === currentUser?.id ? '(You)' : ''}</Typography>
                </Stack>
              </MenuItem>
            ))}
          </Select>
        </Box>
      </Stack>

      <Paper elevation={0} sx={{ borderRadius: 4, overflow: 'hidden', border: '1px solid', borderColor: 'divider', mb: 4 }}>
        {/* Header Summary */}
        <Box sx={{ p: 3, background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', color: 'white' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" alignItems="center" spacing={2}>
              <Avatar src={selectedMember?.avatar_url} sx={{ width: 48, height: 48, border: '2px solid rgba(255,255,255,0.2)' }}>
                {selectedMember?.full_name[0]}
              </Avatar>
              <Box>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>Account Statement For</Typography>
                <Typography variant="h6" fontWeight={700}>{selectedMember?.full_name}</Typography>
              </Box>
            </Stack>
            <Box textAlign="right">
              <Typography variant="body2" sx={{ opacity: 0.8 }}>Current Balance</Typography>
              <Typography variant="h4" fontWeight={800} color={processedEntries[0]?.runningBalance >= 0 ? '#4ade80' : '#f87171'}>
                {processedEntries[0] ? (processedEntries[0].runningBalance >= 0 ? '+' : '') + formatCurrency(processedEntries[0].runningBalance, entries[0]?.currency || 'INR') : formatCurrency(0, 'INR')}
              </Typography>
            </Box>
          </Stack>
        </Box>

        {/* Ledger Table */}
        <Table>
          <TableHead sx={{ bgcolor: 'action.hover' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Transaction Details</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>Amount</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>Running Balance</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {processedEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                  <AccountBalanceWalletRoundedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                  <Typography color="text.secondary">No transactions found in ledger.</Typography>
                </TableCell>
              </TableRow>
            ) : processedEntries.map((entry, index) => {
              const isCredit = entry.parsedAmount > 0;
              const isDebit = entry.parsedAmount < 0;
              return (
                <TableRow key={entry.id} hover>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary" fontWeight={500}>
                      {formatDate(entry.occurred_at)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography fontWeight={600} color="text.primary">
                      {entry.description || 'System Entry'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                      Ref ID: {entry.reference_id?.split('-')[0]}...
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {entry.reference_type === 'expense' ? (
                      <Chip icon={<ReceiptRoundedIcon sx={{ fontSize: 16 }} />} label="Expense" size="small" sx={{ bgcolor: 'primary.50', color: 'primary.700', fontWeight: 600 }} />
                    ) : (
                      <Chip icon={<HandshakeRoundedIcon sx={{ fontSize: 16 }} />} label="Settlement" size="small" sx={{ bgcolor: 'success.50', color: 'success.700', fontWeight: 600 }} />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={0.5}>
                      {isCredit ? <ArrowDownwardRoundedIcon sx={{ fontSize: 14, color: 'success.main' }} /> : isDebit ? <ArrowUpwardRoundedIcon sx={{ fontSize: 14, color: 'error.main' }} /> : null}
                      <Typography fontWeight={700} color={isCredit ? 'success.main' : isDebit ? 'error.main' : 'text.primary'}>
                        {isCredit ? '+' : ''}{formatCurrency(entry.parsedAmount, entry.currency)}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Typography fontWeight={800} color="text.primary">
                      {formatCurrency(entry.runningBalance, entry.currency)}
                    </Typography>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
