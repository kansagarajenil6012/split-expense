import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, TextField, Button, Grid2 as Grid, Alert, Avatar,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth.store.js';
import { usersApi } from '../../services/api.js';
import { getErrorMessage } from '../../services/api-client.js';

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: {
      fullName: user?.full_name || '',
      phone: user?.phone || '',
      defaultCurrency: user?.default_currency || 'INR',
      timezone: user?.timezone || 'Asia/Kolkata',
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data) => usersApi.updateProfile(data),
    onSuccess: (res) => {
      setUser(res.data.data);
      setSuccess('Profile updated successfully');
      setError('');
    },
    onError: (err) => {
      setError(getErrorMessage(err));
      setSuccess('');
    },
  });

  const onSubmit = (data) => {
    updateMutation.mutate({
      fullName: data.fullName,
      phone: data.phone,
      defaultCurrency: data.defaultCurrency,
      timezone: data.timezone,
    });
  };

  return (
    <Box maxWidth={600}>
      <Typography variant="h4" fontWeight={700} gutterBottom>Profile</Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar sx={{ width: 64, height: 64, bgcolor: 'primary.main', fontSize: 24 }}>
              {user?.full_name?.[0]?.toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="h6">{user?.full_name}</Typography>
              <Typography color="text.secondary">{user?.email}</Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card>
        <CardContent>
          <Box component="form" onSubmit={handleSubmit(onSubmit)}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }}>
                <TextField fullWidth label="Full Name" {...register('fullName')} />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField fullWidth label="Phone" {...register('phone')} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Default Currency" {...register('defaultCurrency')} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Timezone" {...register('timezone')} />
              </Grid>
            </Grid>
            <Button type="submit" variant="contained" sx={{ mt: 3 }} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
