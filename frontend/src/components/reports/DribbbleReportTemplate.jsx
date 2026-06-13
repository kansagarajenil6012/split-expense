import React, { forwardRef } from 'react';
import {
  Box, Typography, Avatar, Chip, Stack, Paper,
  Table, TableBody, TableCell, TableHead, TableRow, IconButton
} from '@mui/material';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import BalanceRoundedIcon from '@mui/icons-material/BalanceRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { formatCurrency, formatDate } from '../../utils/formatters.js';

const DribbbleReportTemplate = forwardRef(({ group, members, balances, expenses }, ref) => {
  if (!group || !members || !balances || !expenses) return null;

  const currency = group?.currency || 'INR';
  const totalSpent = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

  // Settlement optimization logic (greedy)
  let settlementRecommendations = [];
  if (balances.length > 0) {
    const debtors = balances.map(b => ({ ...b, balance: parseFloat(b.balance) })).filter(b => b.balance < 0).sort((a, b) => a.balance - b.balance);
    const creditors = balances.map(b => ({ ...b, balance: parseFloat(b.balance) })).filter(b => b.balance > 0).sort((a, b) => b.balance - a.balance);
    
    let i = 0; let j = 0;
    while (i < debtors.length && j < creditors.length) {
      let d = debtors[i];
      let c = creditors[j];
      let amount = Math.min(Math.abs(d.balance), c.balance);
      
      if (amount > 0.01) {
        settlementRecommendations.push({
          from: d.full_name,
          to: c.full_name,
          amount: amount
        });
      }
      
      d.balance += amount;
      c.balance -= amount;
      if (Math.abs(d.balance) < 0.01) i++;
      if (Math.abs(c.balance) < 0.01) j++;
    }
  }

  return (
    <Box 
      ref={ref} 
      sx={{ 
        width: 1000, // Fixed width for consistent PDF output
        bgcolor: '#f8fafc', 
        p: 4, 
        fontFamily: 'sans-serif'
      }}
    >
      {/* Header Banner */}
      <Box 
        sx={{ 
          background: 'linear-gradient(135deg, #6d28d9 0%, #8b5cf6 100%)',
          borderRadius: 4, 
          p: 4, 
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          mb: 4
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center" mb={2}>
          <Box sx={{ bgcolor: 'rgba(255,255,255,0.2)', p: 1.5, borderRadius: 2, display: 'flex' }}>
            <PeopleRoundedIcon sx={{ fontSize: 32 }} />
          </Box>
          <Typography variant="h3" fontWeight={800}>{group?.name}</Typography>
        </Stack>
        <Typography variant="h6" fontWeight={600} mb={1}>Financial Report</Typography>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ opacity: 0.8 }}>
          <EventRoundedIcon fontSize="small" />
          <Typography variant="body2">Generated on: {formatDate(new Date().toISOString())}</Typography>
        </Stack>
      </Box>

      {/* KPI Cards */}
      <Stack direction="row" spacing={3} mb={5}>
        <Paper elevation={0} sx={{ flex: 1, p: 3, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2, border: '1px solid #e2e8f0', bgcolor: 'white' }}>
          <Box sx={{ bgcolor: '#ede9fe', color: '#8b5cf6', p: 2, borderRadius: '50%', display: 'flex' }}>
            <AccountBalanceWalletRoundedIcon />
          </Box>
          <Box>
            <Typography variant="body2" color="#64748b" fontWeight={500}>Total Spent</Typography>
            <Typography variant="h5" fontWeight={800} color="#6d28d9">{formatCurrency(totalSpent, currency)}</Typography>
            <Typography variant="caption" color="#64748b">Across {expenses.length} expenses</Typography>
          </Box>
        </Paper>

        <Paper elevation={0} sx={{ flex: 1, p: 3, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2, border: '1px solid #e2e8f0', bgcolor: 'white' }}>
          <Box sx={{ bgcolor: '#e0f2fe', color: '#0ea5e9', p: 2, borderRadius: '50%', display: 'flex' }}>
            <AssignmentRoundedIcon />
          </Box>
          <Box>
            <Typography variant="body2" color="#64748b" fontWeight={500}>Total Expenses</Typography>
            <Typography variant="h5" fontWeight={800} color="#1e293b">{expenses.length}</Typography>
            <Typography variant="caption" color="#64748b">Total transactions</Typography>
          </Box>
        </Paper>

        <Paper elevation={0} sx={{ flex: 1, p: 3, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2, border: '1px solid #e2e8f0', bgcolor: 'white' }}>
          <Box sx={{ bgcolor: '#dcfce7', color: '#10b981', p: 2, borderRadius: '50%', display: 'flex' }}>
            <GroupsRoundedIcon />
          </Box>
          <Box>
            <Typography variant="body2" color="#64748b" fontWeight={500}>Total Members</Typography>
            <Typography variant="h5" fontWeight={800} color="#1e293b">{members.length}</Typography>
            <Typography variant="caption" color="#64748b">In this group</Typography>
          </Box>
        </Paper>
      </Stack>

      {/* Member Balances */}
      <Box mb={5}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-end" mb={2}>
          <Box>
            <Typography variant="h5" fontWeight={800} color="#1e293b">Member Balances</Typography>
            <Typography variant="body2" color="#64748b">Overview of who owes whom in this group</Typography>
          </Box>
        </Stack>

        <Paper elevation={0} sx={{ borderRadius: 3, overflow: 'hidden', border: '1px solid #e2e8f0', bgcolor: 'white' }}>
          <Table>
            <TableHead sx={{ bgcolor: '#6d28d9' }}>
              <TableRow>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Member</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Net Balance</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>You Will</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {balances.map(b => {
                const bal = parseFloat(b.balance);
                const isPositive = bal > 0;
                const isNegative = bal < 0;
                return (
                  <TableRow key={b.member_id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: isPositive ? '#ede9fe' : isNegative ? '#fee2e2' : '#f1f5f9', color: isPositive ? '#7c3aed' : isNegative ? '#ef4444' : '#64748b', fontSize: 14 }}>
                          {b.full_name[0]}
                        </Avatar>
                        <Typography fontWeight={500} color="#1e293b">{b.full_name}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {isPositive ? (
                        <Box sx={{ bgcolor: '#dcfce7', color: '#166534', px: 1.5, py: 0.5, borderRadius: 2, display: 'inline-block', fontSize: '0.75rem', fontWeight: 600 }}>Gets Back</Box>
                      ) : isNegative ? (
                        <Box sx={{ bgcolor: '#fee2e2', color: '#991b1b', px: 1.5, py: 0.5, borderRadius: 2, display: 'inline-block', fontSize: '0.75rem', fontWeight: 600 }}>Owes</Box>
                      ) : (
                        <Box sx={{ bgcolor: '#f1f5f9', color: '#475569', px: 1.5, py: 0.5, borderRadius: 2, display: 'inline-block', fontSize: '0.75rem', fontWeight: 600 }}>Settled</Box>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={700} color={isPositive ? '#16a34a' : isNegative ? '#dc2626' : '#64748b'}>
                        {isPositive ? '+' : isNegative ? '-' : ''} {formatCurrency(Math.abs(bal), currency)}
                      </Typography>
                    </TableCell>
                      <TableCell>
                      {isPositive ? (
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: '#16a34a' }}>
                          <ArrowDownwardRoundedIcon fontSize="small" />
                          <Typography fontWeight={600} variant="body2">Receive {formatCurrency(Math.abs(bal), currency)}</Typography>
                        </Stack>
                      ) : isNegative ? (
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: '#dc2626' }}>
                          <ArrowUpwardRoundedIcon fontSize="small" />
                          <Typography fontWeight={600} variant="body2">Pay {formatCurrency(Math.abs(bal), currency)}</Typography>
                        </Stack>
                      ) : (
                        <Typography fontWeight={600} variant="body2" color="#64748b">All clear</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          
          {settlementRecommendations.length > 0 && (
            <Box sx={{ bgcolor: '#f5f3ff', p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #ede9fe' }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box sx={{ color: '#7c3aed', p: 1 }}>
                  <BalanceRoundedIcon />
                </Box>
                <Box>
                  <Typography fontWeight={700} color="#5b21b6">
                    {settlementRecommendations[0].from} owes {formatCurrency(settlementRecommendations[0].amount, currency)} to {settlementRecommendations[0].to}
                  </Typography>
                  <Typography variant="caption" color="#7c3aed">Based on optimized settlements</Typography>
                </Box>
              </Stack>
            </Box>
          )}
        </Paper>
      </Box>

      {/* Detailed Expenses */}
      <Box mb={4}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-end" mb={2}>
          <Box>
            <Typography variant="h5" fontWeight={800} color="#1e293b">Detailed Expenses List</Typography>
            <Typography variant="body2" color="#64748b">All expenses in this group</Typography>
          </Box>
        </Stack>

        <Paper elevation={0} sx={{ borderRadius: 3, overflow: 'hidden', border: '1px solid #e2e8f0', bgcolor: 'white' }}>
          <Table>
            <TableHead sx={{ bgcolor: '#6d28d9' }}>
              <TableRow>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Date</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Title</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Category</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Paid By</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Split Type</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }} align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {expenses.map(e => (
                <TableRow key={e.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ color: '#64748b' }}>
                      <EventRoundedIcon fontSize="small" />
                      <Typography variant="body2">{formatDate(e.expense_date)}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography fontWeight={500} color="#1e293b">{e.title}</Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ bgcolor: '#f5f3ff', color: '#7c3aed', px: 1.5, py: 0.5, borderRadius: 1.5, display: 'inline-block', fontSize: '0.75rem', fontWeight: 500 }}>
                      {e.category_name || 'Uncategorized'}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Avatar sx={{ width: 24, height: 24, bgcolor: '#fee2e2', color: '#ef4444', fontSize: 10 }}>
                        {e.paid_by_name?.[0] || '?'}
                      </Avatar>
                      <Typography variant="body2" fontWeight={500} color="#1e293b">{e.paid_by_name}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ color: '#64748b' }}>
                      <PeopleRoundedIcon fontSize="small" />
                      <Typography variant="body2" fontWeight={600}>{e.split_type?.toUpperCase() || 'EQUAL'}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Typography fontWeight={700} color="#1e293b">{formatCurrency(parseFloat(e.amount), currency)}</Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          <Box sx={{ bgcolor: '#f5f3ff', p: 2, px: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #ede9fe' }}>
            <Typography fontWeight={700} color="#5b21b6">Total Expenses</Typography>
            <Typography variant="h6" fontWeight={800} color="#5b21b6">{formatCurrency(totalSpent, currency)}</Typography>
          </Box>
        </Paper>
      </Box>

      {/* Footer Note */}
      <Box sx={{ bgcolor: '#eff6ff', borderRadius: 3, p: 3, display: 'flex', alignItems: 'flex-start', gap: 2, border: '1px solid #bfdbfe' }}>
        <InfoOutlinedIcon sx={{ color: '#3b82f6', mt: 0.2 }} />
        <Box>
          <Typography fontWeight={600} color="#1d4ed8" mb={0.5}>Note</Typography>
          <Typography variant="body2" color="#2563eb">Net balances are calculated based on all expenses and settlements.</Typography>
        </Box>
      </Box>
    </Box>
  );
});

export default DribbbleReportTemplate;
