import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Card, Typography, Button, CircularProgress, Stack, Avatar } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { useMutation } from '@tanstack/react-query';
import { groupsApi } from '../../services/api.js';
import { useAuthStore } from '../../store/auth.store.js';

export default function AcceptInvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [status, setStatus] = useState('loading'); // 'loading', 'success', 'error'
  const [message, setMessage] = useState('Verifying invitation...');

  const acceptMutation = useMutation({
    mutationFn: () => groupsApi.acceptInvite(token),
    onSuccess: (data) => {
      setStatus('success');
      setMessage('You have successfully joined the group!');
      setTimeout(() => {
        navigate('/groups');
      }, 2000);
    },
    onError: (err) => {
      setStatus('error');
      setMessage(err?.response?.data?.message || 'Invalid or expired invitation link.');
    },
  });

  useEffect(() => {
    if (user) {
      acceptMutation.mutate();
    } else {
      // Not logged in, redirect to login and return back here
      sessionStorage.setItem('redirectUrl', `/join/${token}`);
      navigate('/auth/login');
    }
  }, [user, token]);

  return (
    <Box minHeight="100vh" display="flex" alignItems="center" justifyContent="center" bgcolor="background.default" p={3}>
      <Card sx={{ maxWidth: 400, width: '100%', p: 4, textAlign: 'center', borderRadius: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
        {status === 'loading' && (
          <Stack spacing={3} alignItems="center">
            <CircularProgress color="primary" />
            <Typography variant="h6">{message}</Typography>
          </Stack>
        )}
        {status === 'success' && (
          <Stack spacing={3} alignItems="center">
            <CheckCircleRoundedIcon color="success" sx={{ fontSize: 64 }} />
            <Typography variant="h5" fontWeight={700}>Joined!</Typography>
            <Typography color="text.secondary">{message}</Typography>
            <Typography variant="body2" color="text.disabled">Redirecting to your groups...</Typography>
          </Stack>
        )}
        {status === 'error' && (
          <Stack spacing={3} alignItems="center">
            <ErrorOutlineRoundedIcon color="error" sx={{ fontSize: 64 }} />
            <Typography variant="h5" fontWeight={700}>Oops!</Typography>
            <Typography color="text.secondary">{message}</Typography>
            <Button variant="contained" onClick={() => navigate('/groups')} fullWidth>
              Go to My Groups
            </Button>
          </Stack>
        )}
      </Card>
    </Box>
  );
}
