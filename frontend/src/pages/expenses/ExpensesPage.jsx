import { useState } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import {
  Box, Typography, Button, Card, CardContent, List, ListItem,
  ListItemText, IconButton, Chip, Skeleton, Stack, Tooltip, TextField, InputAdornment, MenuItem,
  Menu, Tabs, Tab, Badge
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import FilterAltRoundedIcon from '@mui/icons-material/FilterAltRounded';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import CommentRoundedIcon from '@mui/icons-material/CommentRounded';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import DraftsRoundedIcon from '@mui/icons-material/DraftsRounded';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expensesApi } from '../../services/api.js';
import { formatCurrency, formatDate } from '../../utils/formatters.js';
import { exportToExcel, exportToPDF, exportToCSV, generateExpensesExportData } from '../../utils/exportEngine.js';

export default function ExpensesPage() {
  const { groupId } = useParams();
  const { group } = useOutletContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [exportAnchorEl, setExportAnchorEl] = useState(null);
  
  // Tab state: 'active' or 'drafts'
  const [currentTab, setCurrentTab] = useState('active');

  const handleExportClick = (event) => setExportAnchorEl(event.currentTarget);
  const handleExportClose = () => setExportAnchorEl(null);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', groupId],
    queryFn: async () => {
      const { data } = await expensesApi.getCategories(groupId);
      return data.data;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', groupId],
    queryFn: async () => {
      const { data } = await expensesApi.list(groupId, { limit: 100 });
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (expenseId) => expensesApi.delete(groupId, expenseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
      queryClient.invalidateQueries({ queryKey: ['balances', groupId] });
    },
  });

  const expenses = data?.data || [];

  const filteredExpenses = expenses.filter(e => {
    const matchesSearch = (e.title || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = categoryFilter === 'all' || e.category_id === categoryFilter;
    
    // Tab mapping (Filter out drafts or show drafts only)
    const matchesDraft = currentTab === 'drafts' ? e.is_draft === true : e.is_draft !== true;

    return matchesSearch && matchesCat && matchesDraft;
  });

  const handleExportExcel = () => {
    handleExportClose();
    if (filteredExpenses.length === 0) return;
    const data = generateExpensesExportData(filteredExpenses);
    exportToExcel(data, `Expenses_${group?.name || 'Group'}_${formatDate(new Date())}`);
  };

  const handleExportPDF = () => {
    handleExportClose();
    if (filteredExpenses.length === 0) return;
    const data = generateExpensesExportData(filteredExpenses);
    const headers = ['Date', 'Title', 'Category', 'Paid By', 'Split Type', 'Total Amount'];
    const rows = data.map(d => [d['Date'], d['Title'], d['Category'], d['Paid By'], d['Split Type'], d['Total Amount']]);
    exportToPDF(headers, rows, `Expenses_${group?.name || 'Group'}`, `${group?.name} - Expense Report`);
  };

  const handleExportCSV = () => {
    handleExportClose();
    if (filteredExpenses.length === 0) return;
    const data = generateExpensesExportData(filteredExpenses);
    exportToCSV(data, `Expenses_${group?.name || 'Group'}_${formatDate(new Date())}`);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={2}>
        <Typography variant="h6" fontWeight={600}>Expenses</Typography>
        <Stack direction="row" spacing={2}>
          <Button variant="outlined" startIcon={<FileDownloadRoundedIcon />} onClick={handleExportClick}>
            Export
          </Button>
          <Menu anchorEl={exportAnchorEl} open={Boolean(exportAnchorEl)} onClose={handleExportClose}>
            <MenuItem onClick={handleExportExcel}>Export to Excel (.xlsx)</MenuItem>
            <MenuItem onClick={handleExportPDF}>Export to PDF (.pdf)</MenuItem>
            <MenuItem onClick={handleExportCSV}>Export to CSV (.csv)</MenuItem>
          </Menu>
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => navigate(`/groups/${groupId}/expenses/new`)}
            disabled={group?.is_archived}
          >
            Add Expense
          </Button>
        </Stack>
      </Box>

      {/* Tabs for Active/Draft Toggle */}
      <Tabs
        value={currentTab}
        onChange={(e, val) => setCurrentTab(val)}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
      >
        <Tab label="Active Expenses" value="active" />
        <Tab label="Drafts" value="drafts" />
      </Tabs>

      <Box display="flex" gap={2} mb={3} flexDirection={{ xs: 'column', sm: 'row' }}>
        <TextField
          placeholder="Search expenses..."
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ flexGrow: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          select
          size="small"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          sx={{ minWidth: 200 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <FilterAltRoundedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
        >
          <MenuItem value="all">All Categories</MenuItem>
          {categories.map((c) => (
            <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
          ))}
        </TextField>
      </Box>

      {isLoading ? (
        <Stack spacing={1}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="rectangular" height={72} sx={{ borderRadius: 3 }} />
          ))}
        </Stack>
      ) : filteredExpenses.length === 0 ? (
        <Card sx={{ p: 5, textAlign: 'center' }}>
          <ReceiptLongRoundedIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" fontWeight={600} gutterBottom>
            {currentTab === 'drafts' ? 'No draft expenses found' : 'No expenses found'}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>Try adjusting your search or filters</Typography>
          <Button variant="outlined" onClick={() => { setSearchTerm(''); setCategoryFilter('all'); }}>
            Clear Filters
          </Button>
        </Card>
      ) : (
        <Card>
          <List disablePadding>
            {filteredExpenses.map((expense, i) => (
              <ListItem
                key={expense.id}
                onClick={() => navigate(`/groups/${groupId}/expenses/${expense.id}`)}
                secondaryAction={
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    {/* Attachments indicator */}
                    {expense.attachment_count > 0 && (
                      <Tooltip title={`${expense.attachment_count} attachment(s)`}>
                        <IconButton size="small" sx={{ color: 'text.secondary', pointerEvents: 'none' }}>
                          <AttachFileRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    
                    {/* Comments indicator */}
                    {expense.comment_count > 0 && (
                      <Tooltip title={`${expense.comment_count} comment(s)`}>
                        <IconButton size="small" sx={{ color: 'text.secondary', pointerEvents: 'none' }}>
                          <Badge badgeContent={expense.comment_count} color="primary" slotProps={{ badge: { style: { fontSize: '0.6rem', height: 16, minWidth: 16 } } }}>
                            <CommentRoundedIcon fontSize="small" />
                          </Badge>
                        </IconButton>
                      </Tooltip>
                    )}

                    <Tooltip title="Edit">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/groups/${groupId}/expenses/${expense.id}/edit`);
                        }}
                        sx={{ color: 'text.secondary' }}
                        disabled={group?.is_archived}
                      >
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(expense.id);
                        }}
                        sx={{ color: 'error.main' }}
                        disabled={group?.is_archived}
                      >
                        <DeleteRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                }
                sx={{
                  py: 2,
                  px: 2.5,
                  cursor: 'pointer',
                  borderBottom: i < filteredExpenses.length - 1 ? '1px solid' : 'none',
                  borderColor: 'divider',
                  '&:hover': { bgcolor: 'action.hover' },
                  transition: 'background 0.2s',
                }}
              >
                <ListItemText
                  primary={
                    <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" gap={0.5}>
                      <Typography fontWeight={600}>{expense.title}</Typography>
                      {expense.category_name && <Chip label={expense.category_name} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />}
                      {expense.is_draft && <Chip label="Draft" color="warning" variant="outlined" size="small" sx={{ height: 20, fontSize: '0.7rem' }} />}
                    </Stack>
                  }
                  secondary={
                    <Stack direction="column" spacing={0.5} sx={{ mt: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        {`Paid by ${expense.paid_by_name} · ${formatDate(expense.expense_date)} · ${expense.split_type} split`}
                      </Typography>
                      
                      {/* Emoji Reactions List on card */}
                      {expense.reactions && expense.reactions.length > 0 && (
                        <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                          {expense.reactions.map((r, ri) => (
                            <Chip
                              key={ri}
                              label={`${r.emoji} ${r.count}`}
                              size="small"
                              variant="outlined"
                              sx={{ height: 18, fontSize: '0.65rem', px: 0.5, bgcolor: 'rgba(0,0,0,0.02)' }}
                            />
                          ))}
                        </Stack>
                      )}
                    </Stack>
                  }
                />
                <Typography fontWeight={700} color="primary.main" sx={{ mr: 12 }}>
                  {formatCurrency(expense.amount, group?.currency)}
                </Typography>
              </ListItem>
            ))}
          </List>
        </Card>
      )}
    </Box>
  );
}
