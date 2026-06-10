import React from 'react';
import { Box, Typography, Button, Container } from '@mui/material';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Container maxWidth="sm">
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '100vh',
              textAlign: 'center',
            }}
          >
            <ErrorOutlineRoundedIcon color="error" sx={{ fontSize: 64, mb: 2 }} />
            <Typography variant="h4" fontWeight={700} gutterBottom>
              Oops! Something went wrong.
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 4 }}>
              We're sorry, but an unexpected error occurred. Please try reloading the page.
            </Typography>
            <Button variant="contained" onClick={() => window.location.reload()} size="large">
              Reload Page
            </Button>
          </Box>
        </Container>
      );
    }

    return this.props.children;
  }
}
