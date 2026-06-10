import { useState, useEffect } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Box, Typography, TextField, Button, Link, Alert, Divider, InputAdornment, IconButton, Tabs, Tab,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import EmailRoundedIcon from '@mui/icons-material/EmailRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded';
import VpnKeyRoundedIcon from '@mui/icons-material/VpnKeyRounded';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '../../services/api.js';
import { useAuthStore } from '../../store/auth.store.js';
import { getErrorMessage } from '../../services/api-client.js';
import { GoogleLogin } from '@react-oauth/google';
import { setupRecaptcha, sendOTP } from '../../lib/firebase.js';

const emailSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});

const phoneSchema = z.object({
  phone: z.string().min(10, 'Invalid phone number'),
});

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [tab, setTab] = useState(0); // 0 = Email, 1 = Phone
  
  // Phone OTP State
  const [otpSent, setOtpSent] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [otpCode, setOtpCode] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);

  const { register: registerEmail, handleSubmit: handleEmailSubmit, formState: { errors: emailErrors, isSubmitting: isEmailSubmitting } } = useForm({
    resolver: zodResolver(emailSchema),
  });

  const { register: registerPhone, handleSubmit: handlePhoneSubmit, formState: { errors: phoneErrors } } = useForm({
    resolver: zodResolver(phoneSchema),
  });

  useEffect(() => {
    if (tab === 1) {
      setupRecaptcha('recaptcha-container');
    }
  }, [tab]);

  const onEmailSubmit = async (data) => {
    setError('');
    try {
      const res = await authApi.login(data);
      const { accessToken, refreshToken, user } = res.data.data;
      setAuth({ accessToken, refreshToken, user });
      navigate('/dashboard');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const onPhoneSubmit = async (data) => {
    setError('');
    setPhoneLoading(true);
    try {
      const formattedPhone = data.phone.startsWith('+') ? data.phone : `+91${data.phone}`; // Default to India if no code
      const appVerifier = window.recaptchaVerifier;
      const confResult = await sendOTP(formattedPhone, appVerifier);
      setConfirmationResult(confResult);
      setOtpSent(true);
    } catch (err) {
      setError('Failed to send OTP. Check your number.');
      console.error(err);
    } finally {
      setPhoneLoading(false);
    }
  };

  const verifyOtp = async () => {
    setError('');
    setPhoneLoading(true);
    try {
      const result = await confirmationResult.confirm(otpCode);
      const idToken = await result.user.getIdToken();
      
      const res = await authApi.firebaseLogin(idToken);
      const { accessToken, refreshToken, user } = res.data.data;
      setAuth({ accessToken, refreshToken, user });
      navigate('/dashboard');
    } catch (err) {
      setError('Invalid OTP code.');
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    try {
      const res = await authApi.googleLogin(credentialResponse.credential);
      const { accessToken, refreshToken, user } = res.data.data;
      setAuth({ accessToken, refreshToken, user });
      navigate('/dashboard');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <Box>
      <Box textAlign="center" mb={3}>
        <Typography variant="h4" gutterBottom fontWeight={700}>
          Welcome back
        </Typography>
        <Typography color="text.secondary">Sign in to manage your group expenses</Typography>
      </Box>

      <Tabs value={tab} onChange={(e, v) => setTab(v)} variant="fullWidth" sx={{ mb: 3 }}>
        <Tab label="Email" />
        <Tab label="Mobile OTP" />
      </Tabs>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {tab === 0 ? (
        <Box component="form" onSubmit={handleEmailSubmit(onEmailSubmit)} noValidate>
          <TextField
            fullWidth label="Email" margin="normal" autoComplete="email"
            {...registerEmail('email')} error={!!emailErrors.email} helperText={emailErrors.email?.message}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EmailRoundedIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            fullWidth label="Password" margin="normal" type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            {...registerEmail('password')} error={!!emailErrors.password} helperText={emailErrors.password?.message}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockRoundedIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                    {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <Button
            fullWidth type="submit" variant="contained" size="large"
            disabled={isEmailSubmitting}
            sx={{ mt: 3, mb: 2, py: 1.5, fontSize: '1rem' }}
          >
            {isEmailSubmitting ? 'Signing in...' : 'Sign In'}
          </Button>
        </Box>
      ) : (
        <Box>
          {!otpSent ? (
            <Box component="form" onSubmit={handlePhoneSubmit(onPhoneSubmit)} noValidate>
              <TextField
                fullWidth label="Mobile Number" margin="normal" placeholder="e.g. 9876543210"
                {...registerPhone('phone')} error={!!phoneErrors.phone} helperText={phoneErrors.phone?.message}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PhoneRoundedIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
              />
              <div id="recaptcha-container"></div>
              <Button
                fullWidth type="submit" variant="contained" size="large"
                disabled={phoneLoading}
                sx={{ mt: 3, mb: 2, py: 1.5, fontSize: '1rem' }}
              >
                {phoneLoading ? 'Sending OTP...' : 'Send OTP'}
              </Button>
            </Box>
          ) : (
            <Box>
              <TextField
                fullWidth label="Enter 6-digit OTP" margin="normal"
                value={otpCode} onChange={(e) => setOtpCode(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <VpnKeyRoundedIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                fullWidth variant="contained" size="large" onClick={verifyOtp}
                disabled={phoneLoading || otpCode.length < 6}
                sx={{ mt: 3, mb: 2, py: 1.5, fontSize: '1rem' }}
              >
                {phoneLoading ? 'Verifying...' : 'Verify & Login'}
              </Button>
              <Button fullWidth onClick={() => setOtpSent(false)}>
                Change Number
              </Button>
            </Box>
          )}
        </Box>
      )}

      <Divider sx={{ my: 3, '&::before, &::after': { borderColor: 'rgba(139,92,246,0.15)' } }}>
        <Typography variant="caption" color="text.disabled" sx={{ px: 1 }}>OR CONTINUE WITH</Typography>
      </Divider>

      <Box display="flex" justifyContent="center" mb={3}>
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={() => setError('Google Login Failed')}
          useOneTap
          theme="filled_black"
          shape="pill"
        />
      </Box>

      <Typography textAlign="center" color="text.secondary">
        Don&apos;t have an account?{' '}
        <Link component={RouterLink} to="/register" sx={{ fontWeight: 600, color: 'primary.main' }}>
          Create account
        </Link>
      </Typography>
    </Box>
  );
}
