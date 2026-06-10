import { Snackbar, Alert } from '@mui/material';
import { useUIStore } from '../../store/ui.store.js';

export default function Toast() {
  const { toast, hideToast } = useUIStore();

  return (
    <Snackbar
      open={!!toast}
      autoHideDuration={5000}
      onClose={hideToast}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      {toast ? (
        <Alert onClose={hideToast} severity={toast.severity} sx={{ width: '100%' }} variant="filled">
          {toast.message}
        </Alert>
      ) : <div />}
    </Snackbar>
  );
}
