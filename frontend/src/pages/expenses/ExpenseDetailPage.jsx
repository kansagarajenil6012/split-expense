import { useState } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import {
  Box, Typography, Button, Card, CardContent, Grid2 as Grid,
  Chip, Avatar, List, ListItem, ListItemAvatar, ListItemText,
  Divider, TextField, Stack, IconButton, Tooltip, Alert, Skeleton, Paper
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import ReplyRoundedIcon from '@mui/icons-material/ReplyRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import GetAppRoundedIcon from '@mui/icons-material/GetAppRounded';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import EmojiEmotionsRoundedIcon from '@mui/icons-material/EmojiEmotionsRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expensesApi } from '../../services/api.js';
import { formatCurrency, formatDate } from '../../utils/formatters.js';
import { useAuthStore } from '../../store/auth.store.js';
import { useUIStore } from '../../store/ui.store.js';
import { getErrorMessage } from '../../services/api-client.js';

const QUICK_EMOJIS = ['👍', '😮', '❤️', '👏', '💸', '😕'];

export default function ExpenseDetailPage() {
  const { groupId, expenseId } = useParams();
  const { group } = useOutletContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);

  const [commentText, setCommentText] = useState('');
  const [replyToId, setReplyToId] = useState(null);
  const [replyText, setReplyText] = useState('');

  // Fetch expense details (including participants, payers, items, attachments)
  const { data: expense, isLoading, error } = useQuery({
    queryKey: ['expense', groupId, expenseId],
    queryFn: async () => {
      const { data } = await expensesApi.get(groupId, expenseId);
      return data.data;
    },
  });

  // Fetch comments
  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ['expense-comments', groupId, expenseId],
    queryFn: async () => {
      const { data } = await expensesApi.getComments(groupId, expenseId);
      return data.data;
    },
  });

  // Fetch reactions
  const { data: reactions = [], isLoading: reactionsLoading } = useQuery({
    queryKey: ['expense-reactions', groupId, expenseId],
    queryFn: async () => {
      const { data } = await expensesApi.getReactions(groupId, expenseId);
      return data.data;
    },
  });

  // Fetch revisions history
  const { data: revisions = [] } = useQuery({
    queryKey: ['expense-revisions', groupId, expenseId],
    queryFn: async () => {
      const { data } = await expensesApi.getHistory(groupId, expenseId);
      return data.data;
    },
  });

  // Publish draft mutation
  const publishMutation = useMutation({
    mutationFn: () => expensesApi.publish(groupId, expenseId),
    onSuccess: () => {
      showToast('Expense published successfully');
      queryClient.invalidateQueries({ queryKey: ['expense', groupId, expenseId] });
      queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
    },
    onError: (err) => showToast(getErrorMessage(err), 'error'),
  });

  // Add comment mutation
  const commentMutation = useMutation({
    mutationFn: (data) => expensesApi.addComment(groupId, expenseId, data),
    onSuccess: () => {
      setCommentText('');
      setReplyText('');
      setReplyToId(null);
      queryClient.invalidateQueries({ queryKey: ['expense-comments', groupId, expenseId] });
      queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
    },
    onError: (err) => showToast(getErrorMessage(err), 'error'),
  });

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: (commentId) => expensesApi.deleteComment(groupId, commentId),
    onSuccess: () => {
      showToast('Comment deleted');
      queryClient.invalidateQueries({ queryKey: ['expense-comments', groupId, expenseId] });
    },
    onError: (err) => showToast(getErrorMessage(err), 'error'),
  });

  // React mutation
  const reactMutation = useMutation({
    mutationFn: (emoji) => expensesApi.toggleReaction(groupId, expenseId, { emoji }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-reactions', groupId, expenseId] });
      queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
    },
    onError: (err) => showToast(getErrorMessage(err), 'error'),
  });

  const handleAddComment = (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    commentMutation.mutate({ content: commentText, entityType: 'expense' });
  };

  const handleAddReply = (e, parentId) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    commentMutation.mutate({ content: replyText, entityType: 'expense', parentId });
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 2 }}>
        <Skeleton variant="rectangular" height={150} sx={{ mb: 3, borderRadius: 2 }} />
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
          </Grid>
        </Grid>
      </Box>
    );
  }

  if (error || !expense) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">Failed to load expense details. {error && getErrorMessage(error)}</Alert>
        <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate(`/groups/${groupId}/expenses`)} sx={{ mt: 2 }}>
          Back to Expenses
        </Button>
      </Box>
    );
  }

  const rootComments = comments.filter(c => !c.parent_id);

  // Group reactions by emoji
  const reactionsGrouped = reactions.reduce((acc, r) => {
    if (!acc[r.emoji]) {
      acc[r.emoji] = { count: 0, myReact: false };
    }
    acc[r.emoji].count++;
    if (r.user_id === currentUser?.id) {
      acc[r.emoji].myReact = true;
    }
    return acc;
  }, {});

  return (
    <Box>
      {/* Top action bar */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate(`/groups/${groupId}/expenses`)}>
          Expenses
        </Button>
        
        <Stack direction="row" spacing={2.5}>
          {expense.is_draft && (
            <Button
              variant="contained"
              color="success"
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
            >
              Publish Draft
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<EditRoundedIcon />}
            onClick={() => navigate(`/groups/${groupId}/expenses/${expenseId}/edit`)}
            disabled={group?.is_archived}
          >
            Edit
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={3}>
        {/* Left Column: Details */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                <Box>
                  <Typography variant="h4" fontWeight={800} gutterBottom>
                    {expense.title}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {expense.category_name && <Chip label={expense.category_name} color="primary" variant="outlined" size="small" />}
                    {expense.is_draft && <Chip label="Draft" color="warning" size="small" />}
                  </Stack>
                </Box>
                <Typography variant="h3" fontWeight={800} color="primary.main">
                  {formatCurrency(expense.amount, group?.currency)}
                </Typography>
              </Box>

              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                {expense.description || 'No description provided.'}
              </Typography>

              <Grid container spacing={2} sx={{ mb: 3, p: 2, bgcolor: 'rgba(139, 92, 246, 0.03)', borderRadius: 2, border: '1px solid rgba(139, 92, 246, 0.15)' }}>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary" display="block">Paid By</Typography>
                  <Typography fontWeight={600}>{expense.paid_by_name}</Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary" display="block">Date</Typography>
                  <Typography fontWeight={600}>{formatDate(expense.expense_date)}</Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary" display="block">Split Method</Typography>
                  <Typography fontWeight={600} sx={{ textTransform: 'capitalize' }}>
                    {expense.split_type.replace('_', ' ')}
                  </Typography>
                </Grid>
                {expense.project_name && (
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <Typography variant="caption" color="text.secondary" display="block">Project</Typography>
                    <Typography fontWeight={600}>{expense.project_name}</Typography>
                  </Grid>
                )}
                {expense.notes && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="caption" color="text.secondary" display="block">Notes</Typography>
                    <Typography variant="body2">{expense.notes}</Typography>
                  </Grid>
                )}
              </Grid>

              {/* Payers breakdown if multiple payers */}
              {expense.payers && expense.payers.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" fontWeight={700} gutterBottom>Multiple Payers Breakdown</Typography>
                  <Stack spacing={1}>
                    {expense.payers.map(p => (
                      <Box key={p.id} display="flex" justifyContent="space-between" sx={{ py: 0.5 }}>
                        <Typography variant="body2">{p.full_name}</Typography>
                        <Typography variant="body2" fontWeight={600}>{formatCurrency(p.amount, group?.currency)}</Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}

              <Divider sx={{ my: 3 }} />

              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Split Breakdown</Typography>
              <List disablePadding>
                {expense.participants?.map((p) => (
                  <ListItem key={p.id} sx={{ px: 0, py: 1 }}>
                    <ListItemAvatar>
                      <Avatar sx={{ width: 32, height: 32, fontSize: 13 }}>{p.full_name?.[0]}</Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={<Typography fontWeight={500}>{p.full_name}</Typography>}
                      secondary={
                        p.share_percentage ? `${p.share_percentage}%` : 
                        p.share_units ? `${p.share_units} shares` : ''
                      }
                    />
                    <Typography fontWeight={700} color="text.primary">
                      {formatCurrency(p.share_amount, group?.currency)}
                    </Typography>
                  </ListItem>
                ))}
              </List>

              {/* Item-wise splits items list */}
              {expense.split_type === 'item_wise' && expense.items && expense.items.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" fontWeight={700} gutterBottom>Itemized Bill</Typography>
                  {expense.items.map(item => (
                    <Paper key={item.id} variant="outlined" sx={{ p: 1.5, mb: 1, bgcolor: 'rgba(139, 92, 246, 0.02)', borderColor: 'rgba(139, 92, 246, 0.12)' }}>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" fontWeight={600}>{item.name}</Typography>
                        <Typography variant="body2" fontWeight={600}>{formatCurrency(item.amount, group?.currency)}</Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        Shared by: {item.participants?.map(p => p.full_name).join(', ')}
                      </Typography>
                    </Paper>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column: Attachments, Reactions, Comments */}
        <Grid size={{ xs: 12, md: 5 }}>
          {/* Reactions */}
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>Reactions</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                {QUICK_EMOJIS.map(emoji => {
                  const grouped = reactionsGrouped[emoji];
                  return (
                    <Chip
                      key={emoji}
                      label={`${emoji} ${grouped ? grouped.count : 0}`}
                      onClick={() => reactMutation.mutate(emoji)}
                      color={grouped?.myReact ? 'primary' : 'default'}
                      variant={grouped?.myReact ? 'filled' : 'outlined'}
                      size="small"
                      sx={{ cursor: 'pointer', fontSize: '0.8rem' }}
                    />
                  );
                })}
              </Stack>
            </CardContent>
          </Card>

          {/* Attachments */}
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>Attachments</Typography>
              {expense.attachments && expense.attachments.length > 0 ? (
                <List dense disablePadding>
                  {expense.attachments.map(att => (
                    <ListItem
                      key={att.id}
                      sx={{
                        px: 1.5, py: 1, bgcolor: 'rgba(139, 92, 246, 0.02)', borderRadius: 1.5, mb: 1, border: '1px solid rgba(139, 92, 246, 0.1)'
                      }}
                      secondaryAction={
                        <IconButton
                          edge="end"
                          href={att.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ color: 'primary.main' }}
                        >
                          <GetAppRoundedIcon size="small" />
                        </IconButton>
                      }
                    >
                      <ListItemAvatar sx={{ minWidth: 32 }}>
                        <AttachFileRoundedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      </ListItemAvatar>
                      <ListItemText
                        primary={<Typography variant="body2" noWrap sx={{ maxWidth: '80%' }}>{att.file_name}</Typography>}
                        secondary={<Typography variant="caption" color="text.secondary">{(att.file_size / 1024).toFixed(0)} KB</Typography>}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">No receipt attachments uploaded.</Typography>
              )}
            </CardContent>
          </Card>

          {/* Comments Section */}
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom sx={{ mb: 2 }}>
                Comments ({comments.length})
              </Typography>

              {/* Add Comment Form */}
              <Box component="form" onSubmit={handleAddComment} sx={{ display: 'flex', gap: 1, mb: 3 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Add a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />
                <IconButton type="submit" color="primary" disabled={!commentText.trim() || commentMutation.isPending}>
                  <SendRoundedIcon fontSize="small" />
                </IconButton>
              </Box>

              {/* Threaded Comments List */}
              <List disablePadding>
                {rootComments.map(comment => {
                  const replies = comments.filter(c => c.parent_id === comment.id);
                  return (
                    <Box key={comment.id} sx={{ mb: 2 }}>
                      <ListItem alignItems="flex-start" sx={{ px: 0, py: 0.5 }}>
                        <ListItemAvatar sx={{ minWidth: 40 }}>
                          <Avatar sx={{ width: 28, height: 28, fontSize: 12 }}>{comment.full_name?.[0]}</Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Typography variant="subtitle2" fontWeight={600}>{comment.full_name}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {new Date(comment.created_at).toLocaleDateString()}
                              </Typography>
                            </Stack>
                          }
                          secondary={
                            <Box sx={{ mt: 0.5 }}>
                              <Typography variant="body2" color="text.primary">{comment.content}</Typography>
                              
                              <Stack direction="row" spacing={1.5} sx={{ mt: 0.5 }}>
                                <Button
                                  size="small"
                                  startIcon={<ReplyRoundedIcon sx={{ fontSize: '10px !important' }} />}
                                  onClick={() => setReplyToId(replyToId === comment.id ? null : comment.id)}
                                  sx={{ fontSize: '0.65rem', p: 0, minWidth: 0, textTransform: 'none' }}
                                >
                                  Reply
                                </Button>
                                {comment.user_id === currentUser?.id && (
                                  <Button
                                    size="small"
                                    color="error"
                                    startIcon={<DeleteRoundedIcon sx={{ fontSize: '10px !important' }} />}
                                    onClick={() => deleteCommentMutation.mutate(comment.id)}
                                    sx={{ fontSize: '0.65rem', p: 0, minWidth: 0, textTransform: 'none' }}
                                  >
                                    Delete
                                  </Button>
                                )}
                              </Stack>
                            </Box>
                          }
                        />
                      </ListItem>

                      {/* Reply Input Box */}
                      {replyToId === comment.id && (
                        <Box
                          component="form"
                          onSubmit={(e) => handleAddReply(e, comment.id)}
                          sx={{ display: 'flex', gap: 1, ml: 5, mt: 1, mb: 2 }}
                        >
                          <TextField
                            fullWidth
                            size="small"
                            label="Write a reply..."
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                          />
                          <IconButton type="submit" color="primary" disabled={!replyText.trim() || commentMutation.isPending}>
                            <SendRoundedIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      )}

                      {/* Render nested replies */}
                      {replies.map(reply => (
                        <ListItem key={reply.id} alignItems="flex-start" sx={{ pl: 5, py: 0.5 }}>
                          <ListItemAvatar sx={{ minWidth: 32 }}>
                            <Avatar sx={{ width: 22, height: 22, fontSize: 10 }}>{reply.full_name?.[0]}</Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Stack direction="row" alignItems="center" spacing={1}>
                                <Typography variant="caption" fontWeight={600}>{reply.full_name}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {new Date(reply.created_at).toLocaleDateString()}
                                </Typography>
                              </Stack>
                            }
                            secondary={
                              <Box sx={{ mt: 0.2 }}>
                                <Typography variant="body2" color="text.primary" fontSize="0.8rem">
                                  {reply.content}
                                </Typography>
                                {reply.user_id === currentUser?.id && (
                                  <Button
                                    size="small"
                                    color="error"
                                    startIcon={<DeleteRoundedIcon sx={{ fontSize: '9px !important' }} />}
                                    onClick={() => deleteCommentMutation.mutate(reply.id)}
                                    sx={{ fontSize: '0.6rem', p: 0, mt: 0.2, minWidth: 0, textTransform: 'none' }}
                                  >
                                    Delete
                                  </Button>
                                )}
                              </Box>
                            }
                          />
                        </ListItem>
                      ))}
                    </Box>
                  );
                })}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Bottom Panel: Version History Timeline */}
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                <HistoryRoundedIcon color="secondary" />
                <Typography variant="h6" fontWeight={700}>Version History & Revisions</Typography>
              </Stack>
              
              {revisions.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No revisions have been made to this expense yet. Future edits will create version logs here.
                </Typography>
              ) : (
                <Box sx={{ position: 'relative', pl: 2, mt: 2, '&::before': { content: '""', position: 'absolute', left: 8, top: 10, bottom: 0, width: 2, bgcolor: 'divider' } }}>
                  {revisions.map((rev) => (
                    <Box key={rev.id} sx={{ position: 'relative', mb: 3, pl: 3 }}>
                      <Box sx={{ position: 'absolute', left: -9, top: 4, width: 12, height: 12, borderRadius: '50%', bgcolor: 'secondary.main', border: '2px solid', borderColor: 'background.paper' }} />
                      <Typography variant="caption" color="text.secondary">
                        Version #{rev.revision_number} • {new Date(rev.created_at).toLocaleString()} by {rev.changer_name || 'System User'}
                      </Typography>
                      <Typography variant="body2" color="primary.main" fontWeight={600} sx={{ fontStyle: 'italic', mt: 0.2 }}>
                        "{rev.change_reason || 'Edited expense details'}"
                      </Typography>
                      
                      {rev.diff && Object.keys(rev.diff).length > 0 && (
                        <Box sx={{ mt: 1, p: 1.5, bgcolor: 'rgba(0, 0, 0, 0.25)', borderRadius: 1.5, border: '1px solid rgba(139, 92, 246, 0.15)', fontSize: '0.75rem', fontFamily: 'monospace', color: '#94a3b8' }}>
                          {Object.entries(rev.diff).map(([key, val]) => {
                            const formatDiffVal = (v) => {
                              if (v === null) return 'null';
                              if (v === undefined) return 'undefined';
                              if (typeof v === 'boolean') return v ? 'true' : 'false';
                              if (typeof v === 'object') return JSON.stringify(v);
                              return String(v);
                            };
                            return (
                              <Box key={key} sx={{ mb: 0.4 }}>
                                <span style={{ fontWeight: 600, color: '#c084fc' }}>{key}</span>: was{' '}
                                <span style={{ color: '#f87171', textDecoration: 'line-through', padding: '1px 4px', background: 'rgba(248, 113, 113, 0.1)', borderRadius: 4 }}>{formatDiffVal(val.before)}</span>
                                {' '}changed to{' '}
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
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
