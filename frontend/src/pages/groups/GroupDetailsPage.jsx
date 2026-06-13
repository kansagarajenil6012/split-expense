import { useState, useEffect, useRef } from 'react';
import { useParams, useOutletContext, useNavigate } from 'react-router-dom';
import {
  Box, Grid2 as Grid, Card, CardContent, Typography, Button, Stack, Chip,
  List, ListItem, ListItemAvatar, ListItemText, Avatar, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, Alert,
  IconButton, Tooltip, MenuItem, Divider, Select, FormControl, InputLabel
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CameraAltRoundedIcon from '@mui/icons-material/CameraAltRounded';
import QrCodeRoundedIcon from '@mui/icons-material/QrCodeRounded';
import ArchiveRoundedIcon from '@mui/icons-material/ArchiveRounded';
import UnarchiveRoundedIcon from '@mui/icons-material/UnarchiveRounded';
import FileCopyRoundedIcon from '@mui/icons-material/FileCopyRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import TableChartRoundedIcon from '@mui/icons-material/TableChartRounded';
import NProgress from 'nprogress';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { QRCodeSVG } from 'qrcode.react';
import { settlementsApi, groupsApi, expensesApi } from '../../services/api.js';
import { formatCurrency, getBalanceLabel, GROUP_TYPES } from '../../utils/formatters.js';
import { generateGroupPDFReport, generateGroupExcelReport } from '../../utils/reportGenerator.js';
import DribbbleReportTemplate from '../../components/reports/DribbbleReportTemplate.jsx';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useAuthStore } from '../../store/auth.store.js';
import { useUIStore } from '../../store/ui.store.js';
import { getErrorMessage } from '../../services/api-client.js';

export default function GroupDetailsPage() {
  const { groupId } = useParams();
  const { group } = useOutletContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);
  
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  
  const [hiddenReportData, setHiddenReportData] = useState(null);
  const reportRef = useRef(null);
  
  const [inviteEmail, setInviteEmail] = useState('');
  const [error, setError] = useState('');
  const [clonedName, setClonedName] = useState('');
  const [transferMemberId, setTransferMemberId] = useState('');

  const { data: balances } = useQuery({
    queryKey: ['balances', groupId],
    queryFn: async () => {
      const { data } = await settlementsApi.getBalances(groupId);
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

  const myBalance = balances?.find((b) => b.user_id === user?.id);

  const inviteMutation = useMutation({
    mutationFn: (email) => groupsApi.invite(groupId, email),
    onSuccess: () => {
      setInviteOpen(false);
      setInviteEmail('');
      showToast('Invitation sent successfully');
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] });
      queryClient.invalidateQueries({ queryKey: ['members', groupId] });
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const [shareLink, setShareLink] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  
  const linkMutation = useMutation({
    mutationFn: () => groupsApi.generateShareLink(groupId),
    onSuccess: (data) => {
      setShareLink(data.data.data.link);
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const qrMutation = useMutation({
    mutationFn: () => groupsApi.getQRInvite(groupId),
    onSuccess: (data) => {
      setQrCodeUrl(data.data.data.qrDataUrl);
      if (data.data.data.joinUrl) {
        setShareLink(data.data.data.joinUrl);
      }
    },
    onError: (err) => showToast(getErrorMessage(err), 'error'),
  });

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    showToast('Link copied to clipboard!');
  };

  // Edit group form
  const { register: registerEdit, handleSubmit: handleEditSubmit, formState: { isSubmitting: editSubmitting }, reset: resetEditForm } = useForm({
    defaultValues: {
      name: group?.name || '',
      description: group?.description || '',
      groupType: group?.group_type || 'general',
      tagsString: group?.tags ? group.tags.join(', ') : '',
    },
  });

  // Sync edit form with dynamic group data
  useEffect(() => {
    if (group) {
      resetEditForm({
        name: group.name || '',
        description: group.description || '',
        groupType: group.group_type || 'general',
        tagsString: group.tags ? group.tags.join(', ') : '',
      });
      setClonedName(`${group.name} (Copy)`);
    }
  }, [group, resetEditForm]);

  const editMutation = useMutation({
    mutationFn: (data) => groupsApi.update(groupId, data),
    onSuccess: () => {
      setEditOpen(false);
      showToast('Group updated successfully');
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => groupsApi.delete(groupId),
    onSuccess: () => {
      showToast('Group deleted successfully', 'info');
      navigate('/groups');
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  // Cover image upload mutation
  const coverImageMutation = useMutation({
    mutationFn: (file) => groupsApi.uploadCoverImage(groupId, file),
    onSuccess: () => {
      showToast('Cover image updated successfully');
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] });
    },
    onError: (err) => showToast(getErrorMessage(err), 'error'),
  });

  // Archive / Unarchive mutations
  const archiveMutation = useMutation({
    mutationFn: () => groupsApi.archive(groupId),
    onSuccess: () => {
      showToast('Group archived successfully', 'info');
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (err) => showToast(getErrorMessage(err), 'error'),
  });

  const unarchiveMutation = useMutation({
    mutationFn: () => groupsApi.unarchive(groupId),
    onSuccess: () => {
      showToast('Group unarchived successfully');
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (err) => showToast(getErrorMessage(err), 'error'),
  });

  // Clone Group mutation
  const cloneMutation = useMutation({
    mutationFn: (data) => groupsApi.clone(groupId, data),
    onSuccess: (res) => {
      showToast('Group cloned successfully');
      setCloneOpen(false);
      navigate(`/groups/${res.data.data.id}`);
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (err) => showToast(getErrorMessage(err), 'error'),
  });

  // Transfer Ownership mutation
  const transferMutation = useMutation({
    mutationFn: (toMemberId) => groupsApi.transferOwnership(groupId, { toMemberId }),
    onSuccess: () => {
      showToast('Ownership transferred successfully');
      setTransferOpen(false);
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] });
    },
    onError: (err) => showToast(getErrorMessage(err), 'error'),
  });

  const balanceInfo = myBalance ? getBalanceLabel(myBalance.balance) : null;

  const getBalanceIcon = (type) => {
    if (type === 'owe') return <TrendingDownRoundedIcon />;
    if (type === 'owed') return <TrendingUpRoundedIcon />;
    return <CheckCircleRoundedIcon />;
  };

  const isAdmin = group?.myMembership?.role === 'admin';

  const onEditSubmit = (data) => {
    const tags = data.tagsString.split(',').map((t) => t.trim()).filter(Boolean);
    editMutation.mutate({
      name: data.name,
      description: data.description,
      groupType: data.groupType,
      tags,
    });
  };

  const handleExport = async (format) => {
    try {
      setExportOpen(false);
      NProgress.start();
      showToast(`Generating ${format.toUpperCase()} report...`, 'info');

      // Fetch all expenses by looping pages if necessary
      let allExpenses = [];
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const { data } = await expensesApi.list(groupId, { limit: 100, page });
        allExpenses = allExpenses.concat(data.data);
        if (data.data.length < 100) hasMore = false;
        else page++;
      }

      const reportData = {
        group,
        members: members || [],
        balances: balances || [],
        expenses: allExpenses
      };

      if (format === 'pdf') {
        generateGroupPDFReport(reportData);
      } else {
        generateGroupExcelReport(reportData);
      }
      showToast('Export successful', 'success');
      setExportOpen(false);
    } catch (err) {
      showToast('Failed to export data', 'error');
    } finally {
      NProgress.done();
    }
  };

  const handleExportDribbble = async () => {
    try {
      NProgress.start();
      showToast('Preparing stunning Dribbble PDF...', 'info');
      // Fetch all expenses
      let allExpenses = [];
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const { data } = await expensesApi.list(groupId, { limit: 100, page });
        allExpenses = allExpenses.concat(data.data);
        if (data.data.length < 100) hasMore = false;
        else page++;
      }
      setHiddenReportData({ group, members, balances, allExpenses });
    } catch (err) {
      showToast('Failed to fetch data for export', 'error');
      NProgress.done();
    }
  };

  useEffect(() => {
    if (hiddenReportData && reportRef.current) {
      const generatePDF = async () => {
        try {
          await new Promise(res => setTimeout(res, 500)); // wait for render
          const canvas = await html2canvas(reportRef.current, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#f8fafc',
          });
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'px',
            format: [canvas.width, canvas.height]
          });
          pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
          pdf.save(`${group?.name || 'Group'}_Report.pdf`);
          showToast('PDF downloaded successfully!');
        } catch (err) {
          showToast('Error generating PDF', 'error');
        } finally {
          setHiddenReportData(null);
          NProgress.done();
        }
      };
      generatePDF();
    }
  }, [hiddenReportData, group, showToast]);

  return (
    <Box>
      {/* Dynamic Header with Cover Image & Tags */}
      <Box
        sx={{
          height: 200,
          position: 'relative',
          borderRadius: 2,
          overflow: 'hidden',
          mb: 3,
          background: group?.cover_image_url
            ? `url(${group.cover_image_url}) center/cover no-repeat`
            : 'linear-gradient(135deg, #3f51b5, #9c27b0)',
          display: 'flex',
          alignItems: 'flex-end',
          p: 3,
          boxShadow: 'inset 0 -80px 80px -40px rgba(0,0,0,0.8)',
        }}
      >
        {isAdmin && (
          <Box sx={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 1 }}>
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              id="cover-upload"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) coverImageMutation.mutate(file);
              }}
            />
            <label htmlFor="cover-upload">
              <Button
                variant="contained"
                component="span"
                size="small"
                startIcon={<CameraAltRoundedIcon />}
                sx={{ bgcolor: 'rgba(0,0,0,0.6)', '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' } }}
              >
                Change Cover
              </Button>
            </label>
            
            {group?.is_archived ? (
              <Button
                variant="contained"
                size="small"
                startIcon={<UnarchiveRoundedIcon />}
                onClick={() => unarchiveMutation.mutate()}
                sx={{ bgcolor: 'success.main', '&:hover': { bgcolor: 'success.dark' } }}
              >
                Unarchive
              </Button>
            ) : (
              <Button
                variant="contained"
                size="small"
                startIcon={<ArchiveRoundedIcon />}
                onClick={() => archiveMutation.mutate()}
                sx={{ bgcolor: 'warning.main', '&:hover': { bgcolor: 'warning.dark' } }}
              >
                Archive
              </Button>
            )}
          </Box>
        )}

        <Box sx={{ color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.6)', width: '100%' }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Typography variant="h4" fontWeight={800}>{group?.name}</Typography>
            {group?.is_archived && (
              <Chip label="Archived" color="warning" size="small" sx={{ color: 'white', fontWeight: 600 }} />
            )}
          </Stack>
          <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>{group?.description || 'No description'}</Typography>
          {group?.tags && group.tags.length > 0 && (
            <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
              {group.tags.map((tag) => (
                <Chip key={tag} label={tag} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
              ))}
            </Stack>
          )}
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Balance Card */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card
            sx={{
              background: balanceInfo?.type === 'owe'
                ? 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(248,113,113,0.06))'
                : balanceInfo?.type === 'owed'
                ? 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(52,211,153,0.06))'
                : 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.06))',
            }}
          >
            <CardContent sx={{ py: 3 }}>
              <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                <Box sx={{ color: balanceInfo?.color || 'primary.main' }}>
                  {getBalanceIcon(balanceInfo?.type)}
                </Box>
                <Typography color="text.secondary" fontSize="0.85rem">Your Balance</Typography>
              </Stack>
              <Typography variant="h3" fontWeight={800} color={balanceInfo?.color || 'text.primary'}>
                {myBalance ? formatCurrency(Math.abs(myBalance.balance), group?.currency) : formatCurrency(0, group?.currency)}
              </Typography>
              <Typography variant="body2" color={balanceInfo?.color} sx={{ mt: 0.5 }}>{balanceInfo?.text || 'Settled up'}</Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Actions */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ width: '100%' }}>
            <Button
              variant="contained"
              startIcon={<AddRoundedIcon />}
              onClick={() => navigate(`/groups/${groupId}/expenses/new`)}
              size="large"
              sx={{ width: { xs: '100%', sm: 'auto' } }}
              disabled={group?.is_archived}
            >
              Add Expense
            </Button>
            <Button
              variant="outlined"
              startIcon={<HandshakeRoundedIcon />}
              onClick={() => navigate(`/groups/${groupId}/settlement`)}
              size="large"
              sx={{ width: { xs: '100%', sm: 'auto' } }}
              disabled={group?.is_archived}
            >
              Settle Up
            </Button>
            <Button
              variant="outlined"
              startIcon={<PersonAddRoundedIcon />}
              onClick={() => setInviteOpen(true)}
              size="large"
              sx={{ width: { xs: '100%', sm: 'auto' } }}
              disabled={group?.is_archived}
            >
              Invite
            </Button>
            <Button
              variant="outlined"
              startIcon={<FileCopyRoundedIcon />}
              onClick={() => setCloneOpen(true)}
              size="large"
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Clone Group
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadRoundedIcon />}
              onClick={handleExportDribbble}
              size="large"
              color="secondary"
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Export Report
            </Button>
            <Stack direction="row" spacing={1} sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}>
              {isAdmin && (
                <>
                  <Tooltip title="Transfer Ownership">
                    <IconButton onClick={() => setTransferOpen(true)} sx={{ border: '1px solid', borderColor: 'divider' }}>
                      <SwapHorizRoundedIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Edit Group">
                    <IconButton onClick={() => setEditOpen(true)} sx={{ border: '1px solid', borderColor: 'divider' }}>
                      <EditRoundedIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete Group">
                    <IconButton onClick={() => setDeleteOpen(true)} sx={{ border: '1px solid', borderColor: 'divider', color: 'error.main' }}>
                      <DeleteRoundedIcon />
                    </IconButton>
                  </Tooltip>
                </>
              )}
            </Stack>
          </Stack>
        </Grid>

        {/* Member Balances */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>Member Balances</Typography>
              <List dense disablePadding>
                {balances?.map((b) => {
                  const info = getBalanceLabel(b.balance);
                  return (
                    <ListItem key={b.member_id} sx={{ py: 1, px: 0 }}>
                      <ListItemAvatar>
                        <Avatar sx={{ width: 36, height: 36, fontSize: 14 }}>{b.full_name?.[0]}</Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={<Typography fontWeight={500}>{b.full_name}</Typography>}
                        secondary={info.text}
                      />
                      <Typography fontWeight={700} color={info.color} fontSize="0.95rem">
                        {formatCurrency(Math.abs(b.balance), group?.currency)}
                      </Typography>
                    </ListItem>
                  );
                })}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Members */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>Members ({members?.length || 0})</Typography>
              <List dense disablePadding>
                {members?.map((m) => (
                  <ListItem key={m.id} sx={{ py: 1, px: 0 }}>
                    <ListItemAvatar>
                      <Avatar sx={{ width: 36, height: 36, fontSize: 14 }}>{m.full_name?.[0]}</Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={<Typography fontWeight={500}>{m.full_name}</Typography>}
                      secondary={m.email}
                    />
                    <Chip
                      label={m.role}
                      size="small"
                      color={m.role === 'admin' ? 'primary' : 'default'}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Invite Dialog with QR Invite Option */}
      <Dialog open={inviteOpen} onClose={() => { setInviteOpen(false); setShareLink(''); setQrCodeUrl(''); }} maxWidth="sm" fullWidth>
        <DialogTitle>Invite Member</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          
          <Typography variant="subtitle2" fontWeight={600} gutterBottom mt={1}>Invite via Email or Phone</Typography>
          <Box display="flex" gap={1} mb={3}>
            <TextField
              fullWidth label="Email or Phone Number" type="text" size="small"
              value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="e.g. email@domain.com or +919876543210"
            />
            <Button
              variant="contained"
              disabled={!inviteEmail || inviteMutation.isPending}
              onClick={() => inviteMutation.mutate(inviteEmail)}
            >
              Send
            </Button>
          </Box>

          <Divider sx={{ my: 2 }}>OR</Divider>

          <Typography variant="subtitle2" fontWeight={600} gutterBottom>Invite via Link (Works for WhatsApp / Telegram)</Typography>
          {shareLink ? (
            <Box display="flex" gap={1} mb={2}>
              <TextField fullWidth value={shareLink} size="small" InputProps={{ readOnly: true }} />
              <Button variant="outlined" onClick={handleCopyLink} startIcon={<ContentCopyRoundedIcon />}>
                Copy
              </Button>
            </Box>
          ) : (
            <Button 
              variant="outlined" 
              fullWidth 
              startIcon={<LinkRoundedIcon />}
              onClick={() => linkMutation.mutate()}
              disabled={linkMutation.isPending}
              sx={{ mb: 2 }}
            >
              Generate Shareable Link
            </Button>
          )}

          <Typography variant="subtitle2" fontWeight={600} gutterBottom mt={2}>Invite via QR Invite Code</Typography>
          {qrCodeUrl ? (
            <Box display="flex" flexDirection="column" alignItems="center" gap={2} sx={{ mt: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 2 }}>
              <QRCodeSVG value={shareLink} size={200} includeMargin={true} />
              <Typography variant="caption" color="text.secondary">Scan this code to join "{group?.name}" instantly</Typography>
            </Box>
          ) : (
            <Button
              variant="outlined"
              fullWidth
              startIcon={<QrCodeRoundedIcon />}
              onClick={() => qrMutation.mutate()}
              disabled={qrMutation.isPending}
            >
              Show QR Code Invite
            </Button>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setInviteOpen(false); setShareLink(''); setQrCodeUrl(''); }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Group Dialog (Extended with Tags) */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Group</DialogTitle>
        <Box component="form" onSubmit={handleEditSubmit(onEditSubmit)}>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <TextField fullWidth label="Group Name" margin="normal" required {...registerEdit('name')} />
            <TextField fullWidth label="Description" margin="normal" multiline rows={2} {...registerEdit('description')} />
            <TextField fullWidth select label="Group Type" margin="normal" {...registerEdit('groupType')}>
              {GROUP_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              label="Tags (comma-separated)"
              margin="normal"
              placeholder="e.g. trip, office, flatmates"
              helperText="Press comma (,) to separate tags"
              {...registerEdit('tagsString')}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={editSubmitting}>Save</Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Delete Group Dialog */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Group</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This action will soft-delete the group. All data will be preserved but the group will no longer be accessible.
          </Alert>
          <Typography>Are you sure you want to delete <strong>{group?.name}</strong>?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            Delete Group
          </Button>
        </DialogActions>
      </Dialog>

      {/* Clone Group Dialog */}
      <Dialog open={cloneOpen} onClose={() => setCloneOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Clone Group</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Create a duplicate of this group. The cloned group will copy all members, categories, and settings, but will start with a fresh expense and settlement ledger history.
          </Typography>
          <TextField
            fullWidth
            label="Cloned Group Name"
            value={clonedName}
            onChange={(e) => setClonedName(e.target.value)}
            required
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloneOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => cloneMutation.mutate({ name: clonedName })}
            disabled={cloneMutation.isPending || !clonedName.trim()}
          >
            Clone Group
          </Button>
        </DialogActions>
      </Dialog>

      {/* Transfer Ownership Dialog */}
      <Dialog open={transferOpen} onClose={() => setTransferOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Transfer Group Ownership</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 3 }}>
            Promote another member to group admin and demote yourself to a regular member. You will lose all administrative control over this group.
          </Typography>
          
          <FormControl fullWidth size="medium">
            <InputLabel>Select New Admin Owner</InputLabel>
            <Select
              value={transferMemberId}
              label="Select New Admin Owner"
              onChange={(e) => setTransferMemberId(e.target.value)}
            >
              {members
                ?.filter((m) => m.user_id !== user?.id && m.status === 'active')
                ?.map((m) => (
                  <MenuItem key={m.id} value={m.id}>
                    {m.full_name} ({m.email})
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransferOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => transferMutation.mutate(transferMemberId)}
            disabled={transferMutation.isPending || !transferMemberId}
          >
            Transfer Ownership
          </Button>
        </DialogActions>
      </Dialog>
      {/* Export Report Modal */}
      <Dialog open={exportOpen} onClose={() => setExportOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Export Group Report</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Choose the format to download a comprehensive report including group totals, member balances, and all detailed expenses.
          </Typography>
          <Stack spacing={2}>
            <Button 
              variant="outlined" 
              size="large" 
              startIcon={<PictureAsPdfRoundedIcon sx={{ color: '#ef4444' }} />}
              onClick={() => handleExport('pdf')}
              sx={{ justifyContent: 'flex-start', py: 1.5, borderColor: 'divider', color: 'text.primary' }}
            >
              Download PDF Document
            </Button>
            <Button 
              variant="outlined" 
              size="large" 
              startIcon={<TableChartRoundedIcon sx={{ color: '#10b981' }} />}
              onClick={() => handleExport('excel')}
              sx={{ justifyContent: 'flex-start', py: 1.5, borderColor: 'divider', color: 'text.primary' }}
            >
              Download Excel Spreadsheet
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setExportOpen(false)} color="inherit">Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Hidden Dribbble Template for PDF Rendering */}
      {hiddenReportData && (
        <Box sx={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
          <DribbbleReportTemplate 
            ref={reportRef}
            group={hiddenReportData.group}
            members={hiddenReportData.members}
            balances={hiddenReportData.balances}
            expenses={hiddenReportData.allExpenses}
          />
        </Box>
      )}

    </Box>
  );
}
