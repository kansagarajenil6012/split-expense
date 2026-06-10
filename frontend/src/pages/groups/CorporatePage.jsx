import { useState } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import {
  Box, Typography, Button, Grid2 as Grid, Card, CardContent,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, Chip, Stack, Skeleton, Alert, Divider, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper
} from '@mui/material';
import ApproveIcon from '@mui/icons-material/CheckCircleOutline';
import RejectIcon from '@mui/icons-material/HighlightOff';
import CorporateFareIcon from '@mui/icons-material/CorporateFare';
import SettingsIcon from '@mui/icons-material/Settings';
import DownloadIcon from '@mui/icons-material/Download';
import AddIcon from '@mui/icons-material/Add';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { corporateApi, groupsApi } from '../../services/api.js';
import { formatCurrency } from '../../utils/formatters.js';
import { getErrorMessage } from '../../services/api-client.js';
import { useUIStore } from '../../store/ui.store.js';
import dayjs from 'dayjs';

export default function CorporatePage() {
  const { groupId } = useParams();
  const { group } = useOutletContext();
  const queryClient = useQueryClient();
  const showToast = useUIStore((s) => s.showToast);

  const [activeTab, setActiveTab] = useState(0);
  const [error, setError] = useState('');
  const [openDept, setOpenDept] = useState(false);
  const [openCC, setOpenCC] = useState(false);

  // Queries
  const { data: pendingExpenses, isLoading: isPendingLoading } = useQuery({
    queryKey: ['corporatePending', groupId],
    queryFn: async () => {
      const { data } = await corporateApi.getPending(groupId);
      return data.data;
    },
  });

  const { data: departments, isLoading: isDeptsLoading } = useQuery({
    queryKey: ['departments', groupId],
    queryFn: async () => {
      const { data } = await corporateApi.getDepartments(groupId);
      return data.data;
    },
  });

  const { data: costCenters, isLoading: isCCsLoading } = useQuery({
    queryKey: ['costCenters', groupId],
    queryFn: async () => {
      const { data } = await corporateApi.getCostCenters(groupId);
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

  // Forms
  const deptForm = useForm({ defaultValues: { name: '', managerMemberId: '' } });
  const ccForm = useForm({ defaultValues: { code: '', name: '' } });

  // Mutations
  const approveMutation = useMutation({
    mutationFn: (expenseId) => corporateApi.approve(groupId, expenseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['corporatePending', groupId] });
      queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
      queryClient.invalidateQueries({ queryKey: ['balances', groupId] });
      showToast('Expense approved successfully');
    },
    onError: (err) => showToast(getErrorMessage(err), 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: (expenseId) => corporateApi.reject(groupId, expenseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['corporatePending', groupId] });
      showToast('Expense rejected successfully');
    },
    onError: (err) => showToast(getErrorMessage(err), 'error'),
  });

  const createDeptMutation = useMutation({
    mutationFn: (data) => corporateApi.createDepartment(groupId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments', groupId] });
      showToast('Department created successfully');
      setOpenDept(false);
      deptForm.reset();
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const createCCMutation = useMutation({
    mutationFn: (data) => corporateApi.createCostCenter(groupId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['costCenters', groupId] });
      showToast('Cost Center created successfully');
      setOpenCC(false);
      ccForm.reset();
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const onDeptSubmit = (data) => {
    setError('');
    createDeptMutation.mutate(data);
  };

  const onCCSubmit = (data) => {
    setError('');
    createCCMutation.mutate(data);
  };

  const handleDownloadPayroll = async () => {
    try {
      const response = await corporateApi.payrollExport(groupId);
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payroll-export-${groupId}-${dayjs().format('YYYY-MM-DD')}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast('Payroll report downloaded successfully');
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Corporate Management Panel</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage cost allocations, departments, and approve business expenses.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={handleDownloadPayroll}
          sx={{
            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.4)',
            '&:hover': {
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
            }
          }}
        >
          Export Payroll Report
        </Button>
      </Box>

      <Tabs
        value={activeTab}
        onChange={(_, val) => setActiveTab(val)}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
      >
        <Tab label="Expense Approvals" icon={<ApproveIcon />} iconPosition="start" />
        <Tab label="Org Hierarchy & Config" icon={<CorporateFareIcon />} iconPosition="start" />
        <Tab label="Department Config" icon={<SettingsIcon />} iconPosition="start" />
      </Tabs>

      {/* Tab 0: Approvals Dashboard */}
      {activeTab === 0 && (
        <Box>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
            Awaiting Manager Approvals
          </Typography>

          {isPendingLoading ? (
            <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 3 }} />
          ) : pendingExpenses?.length === 0 ? (
            <Card sx={{ p: 5, textAlign: 'center', border: '1px dashed rgba(255, 255, 255, 0.1)', background: 'transparent' }}>
              <ApproveIcon sx={{ fontSize: 48, color: 'success.light', mb: 1.5, opacity: 0.8 }} />
              <Typography variant="subtitle1" fontWeight={600}>All caught up!</Typography>
              <Typography variant="body2" color="text.secondary">
                No corporate expenses are currently pending manager approval.
              </Typography>
            </Card>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell fontWeight={600}>Expense Title</TableCell>
                    <TableCell>Project Name</TableCell>
                    <TableCell>Paid By</TableCell>
                    <TableCell>Cost Center</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pendingExpenses.map((exp) => (
                    <TableRow key={exp.id}>
                      <TableCell fontWeight={600}>{exp.title}</TableCell>
                      <TableCell>{exp.project_name || 'N/A'}</TableCell>
                      <TableCell>{exp.paid_by_name}</TableCell>
                      <TableCell>
                        <Chip
                          label={exp.cost_center_name || 'None'}
                          size="small"
                          color={exp.cost_center_name ? 'secondary' : 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{dayjs(exp.expense_date).format('MMM DD, YYYY')}</TableCell>
                      <TableCell align="right" fontWeight={700} color="primary.main">
                        {formatCurrency(parseFloat(exp.amount), group?.currency)}
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={1} justifyContent="center">
                          <Button
                            size="small"
                            variant="outlined"
                            color="success"
                            startIcon={<ApproveIcon />}
                            onClick={() => approveMutation.mutate(exp.id)}
                            disabled={approveMutation.isPending}
                          >
                            Approve
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            startIcon={<RejectIcon />}
                            onClick={() => rejectMutation.mutate(exp.id)}
                            disabled={rejectMutation.isPending}
                          >
                            Reject
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* Tab 1: Org Hierarchy Config */}
      {activeTab === 1 && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6" fontWeight={700}>Cost Centers</Typography>
                  <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => setOpenCC(true)}>Add CC</Button>
                </Box>
                {isCCsLoading ? (
                  <Skeleton variant="rectangular" height={120} />
                ) : costCenters?.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" textAlign="center" py={3}>No cost centers defined yet.</Typography>
                ) : (
                  <Stack spacing={1}>
                    {costCenters.map((cc) => (
                      <Box
                        key={cc.id}
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{ p: 1.5, border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 2 }}
                      >
                        <Box>
                          <Typography fontWeight={600} variant="body2">{cc.name}</Typography>
                          <Typography variant="caption" color="text.secondary">Code: {cc.code}</Typography>
                        </Box>
                        <Chip label={cc.code} size="small" color="primary" variant="outlined" />
                      </Box>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6" fontWeight={700}>Departments</Typography>
                  <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => setOpenDept(true)}>Add Dept</Button>
                </Box>
                {isDeptsLoading ? (
                  <Skeleton variant="rectangular" height={120} />
                ) : departments?.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" textAlign="center" py={3}>No departments defined yet.</Typography>
                ) : (
                  <Stack spacing={1}>
                    {departments.map((dept) => (
                      <Box
                        key={dept.id}
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{ p: 1.5, border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 2 }}
                      >
                        <Box>
                          <Typography fontWeight={600} variant="body2">{dept.name}</Typography>
                          <Typography variant="caption" color="text.secondary">Manager ID: {dept.manager_member_id || 'Not Assigned'}</Typography>
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tab 2: Department and Member Settings Info */}
      {activeTab === 2 && (
        <Card sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>Member Payroll Claims</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Here is a summary of all employee claims. A reimbursement claim represents the money the business owes them.
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Full Name</TableCell>
                    <TableCell>Employee ID</TableCell>
                    <TableCell align="right">Paid by Employee</TableCell>
                    <TableCell align="right">Owed by Employee</TableCell>
                    <TableCell align="right">Net Balance</TableCell>
                    <TableCell align="right">Reimbursement Claim</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {members?.map((m) => {
                    const paid = parseFloat(m.total_paid || 0);
                    const owed = parseFloat(m.total_owed || 0);
                    const net = owed - paid;
                    const claim = net < 0 ? Math.abs(net) : 0;
                    return (
                      <TableRow key={m.id}>
                        <TableCell fontWeight={600}>{m.full_name}</TableCell>
                        <TableCell>{m.employee_id || 'N/A'}</TableCell>
                        <TableCell align="right">{formatCurrency(paid, group?.currency)}</TableCell>
                        <TableCell align="right">{formatCurrency(owed, group?.currency)}</TableCell>
                        <TableCell align="right" color={net < 0 ? 'success.main' : 'error.main'}>
                          {net.toFixed(2)}
                        </TableCell>
                        <TableCell align="right" fontWeight={700} color="success.main">
                          {formatCurrency(claim, group?.currency)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Add CC Dialog */}
      <Dialog open={openCC} onClose={() => setOpenCC(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Cost Center</DialogTitle>
        <Box component="form" onSubmit={ccForm.handleSubmit(onCCSubmit)}>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <TextField fullWidth label="Cost Center Code (e.g. FIN-101)" required margin="normal" {...ccForm.register('code')} />
            <TextField fullWidth label="Name" required margin="normal" {...ccForm.register('name')} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenCC(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={createCCMutation.isPending}>
              Create
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Add Department Dialog */}
      <Dialog open={openDept} onClose={() => setOpenDept(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Department</DialogTitle>
        <Box component="form" onSubmit={deptForm.handleSubmit(onDeptSubmit)}>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <TextField fullWidth label="Department Name" required margin="normal" {...deptForm.register('name')} />
            <TextField fullWidth select label="Manager Member" margin="normal" {...deptForm.register('managerMemberId')}>
              <MenuItem value="">None</MenuItem>
              {members?.map((m) => (
                <MenuItem key={m.id} value={m.id}>{m.full_name}</MenuItem>
              ))}
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDept(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={createDeptMutation.isPending}>
              Create
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
