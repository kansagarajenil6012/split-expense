import { useState } from 'react';
import { useParams, useOutletContext, useNavigate } from 'react-router-dom';
import {
  Box, Grid2 as Grid, Card, CardContent, Typography, Button, Stack, Chip,
  List, ListItem, ListItemAvatar, ListItemText, Avatar, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, Alert,
  IconButton, Tooltip, MenuItem, Divider,
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { settlementsApi, groupsApi } from '../../services/api.js';
import { formatCurrency, getBalanceLabel, GROUP_TYPES } from '../../utils/formatters.js';
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
  const [inviteEmail, setInviteEmail] = useState('');
  const [error, setError] = useState('');

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
  
  const linkMutation = useMutation({
    mutationFn: () => groupsApi.generateShareLink(groupId),
    onSuccess: (data) => {
      setShareLink(data.data.data.link);
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    showToast('Link copied to clipboard!');
  };

  // Edit group form
  const { register: registerEdit, handleSubmit: handleEditSubmit, formState: { isSubmitting: editSubmitting } } = useForm({
    defaultValues: {
      name: group?.name || '',
      description: group?.description || '',
      groupType: group?.group_type || 'general',
    },
  });

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

  const balanceInfo = myBalance ? getBalanceLabel(myBalance.balance) : null;

  const getBalanceIcon = (type) => {
    if (type === 'owe') return <TrendingDownRoundedIcon />;
    if (type === 'owed') return <TrendingUpRoundedIcon />;
    return <CheckCircleRoundedIcon />;
  };

  const isAdmin = group?.myMembership?.role === 'admin';

  return (
    <Box>
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
            >
              Add Expense
            </Button>
            <Button
              variant="outlined"
              startIcon={<HandshakeRoundedIcon />}
              onClick={() => navigate(`/groups/${groupId}/settlement`)}
              size="large"
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Settle Up
            </Button>
            <Button
              variant="outlined"
              startIcon={<PersonAddRoundedIcon />}
              onClick={() => setInviteOpen(true)}
              size="large"
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Invite
            </Button>
            <Stack direction="row" spacing={1} sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}>
              {isAdmin && (
                <>
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

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onClose={() => { setInviteOpen(false); setShareLink(''); }} maxWidth="sm" fullWidth>
        <DialogTitle>Invite Member</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          
          <Typography variant="subtitle2" fontWeight={600} gutterBottom mt={1}>Invite via Email or Phone</Typography>
          <Box display="flex" gap={1} mb={3}>
            <TextField
              fullWidth label="Email or Phone Number" type="text" size="small"
              value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="e.g. +919876543210"
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

          <Typography variant="subtitle2" fontWeight={600} gutterBottom>Invite via Link (Works for WhatsApp / Mobile)</Typography>
          {shareLink ? (
            <Box display="flex" gap={1}>
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
            >
              Generate Shareable Link
            </Button>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setInviteOpen(false); setShareLink(''); }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Group Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Group</DialogTitle>
        <Box component="form" onSubmit={handleEditSubmit((data) => editMutation.mutate(data))}>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <TextField fullWidth label="Group Name" margin="normal" required {...registerEdit('name')} />
            <TextField fullWidth label="Description" margin="normal" multiline rows={2} {...registerEdit('description')} />
            <TextField fullWidth select label="Group Type" margin="normal" {...registerEdit('groupType')}>
              {GROUP_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </TextField>
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
    </Box>
  );
}
