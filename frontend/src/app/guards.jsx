import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store.js';
import { useEffect, useState } from 'react';
import { authApi } from '../services/api.js';
import { Box, CircularProgress } from '@mui/material';

export function ProtectedRoute() {
  const location = useLocation();
  const { accessToken, refreshToken, setAuth, user, clearAuth } = useAuthStore();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      if (accessToken && user) {
        setChecking(false);
        return;
      }

      if (refreshToken) {
        try {
          const { data } = await authApi.refresh(refreshToken);
          const { accessToken: newAccess, refreshToken: newRefresh, user: u } = data.data;
          setAuth({ accessToken: newAccess, refreshToken: newRefresh, user: u });
        } catch {
          clearAuth();
        }
      }
      setChecking(false);
    };
    initAuth();
  }, []);

  if (checking) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  const token = useAuthStore.getState().accessToken;
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

export function PublicRoute() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);

  if (accessToken || refreshToken) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
