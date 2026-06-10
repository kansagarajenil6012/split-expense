import { Outlet } from 'react-router-dom';
import { Box, Container, Paper, Typography, Stack } from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';

export default function AuthLayout() {
  return (
    <Box
      minHeight="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      sx={{
        background: 'radial-gradient(ellipse at 30% 20%, rgba(99,102,241,0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(168,85,247,0.1) 0%, transparent 50%), #0f0f23',
      }}
    >
      <Container maxWidth="sm">
        <Box sx={{ animation: 'fadeInUp 0.5s ease forwards' }}>
          {/* Logo */}
          <Stack direction="row" alignItems="center" justifyContent="center" spacing={1.5} sx={{ mb: 4 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 3,
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)',
              }}
            >
              <AccountBalanceWalletIcon sx={{ color: '#fff', fontSize: 28 }} />
            </Box>
            <Typography variant="h5" fontWeight={800} className="gradient-text">
              Split Expense
            </Typography>
          </Stack>

          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, sm: 4 },
              borderRadius: 4,
              background: 'rgba(26, 26, 62, 0.7)',
              backdropFilter: 'blur(30px)',
              border: '1px solid rgba(139, 92, 246, 0.15)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3), 0 0 80px rgba(99, 102, 241, 0.05)',
            }}
          >
            <Outlet />
          </Paper>

          <Typography variant="body2" textAlign="center" sx={{ mt: 3, color: 'text.disabled' }}>
            Split expenses effortlessly with your groups
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
