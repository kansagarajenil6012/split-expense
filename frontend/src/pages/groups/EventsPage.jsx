import { useState } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import {
  Box, Typography, Button, Grid2 as Grid, Card, CardContent,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, Chip, Stack, Skeleton, Alert, Divider, Checkbox,
  FormControlLabel, Tabs, Tab, Avatar, Paper, IconButton
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import EventIcon from '@mui/icons-material/Event';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { eventsApi, groupsApi, expensesApi } from '../../services/api.js';
import { formatCurrency } from '../../utils/formatters.js';
import { getErrorMessage } from '../../services/api-client.js';
import { useUIStore } from '../../store/ui.store.js';
import dayjs from 'dayjs';

export default function EventsPage() {
  const { groupId } = useParams();
  const { group } = useOutletContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const showToast = useUIStore((s) => s.showToast);

  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [editingEvent, setEditingEvent] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState(0);

  // For attendance state management
  const [attendanceState, setAttendanceState] = useState({});

  const { data: events, isLoading: isEventsLoading } = useQuery({
    queryKey: ['events', groupId],
    queryFn: async () => {
      const { data } = await eventsApi.list(groupId);
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

  const { data: expenses } = useQuery({
    queryKey: ['expenses', groupId],
    queryFn: async () => {
      const { data } = await expensesApi.list(groupId, { limit: 100, offset: 0 });
      return data.data.expenses;
    },
  });

  const { data: attendanceData, isLoading: isAttendanceLoading } = useQuery({
    queryKey: ['attendance', groupId, selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return null;
      const { data } = await eventsApi.getAttendance(groupId, selectedEventId);
      return data.data;
    },
    enabled: !!selectedEventId,
  });

  const { data: ledgerData, isLoading: isLedgerLoading } = useQuery({
    queryKey: ['eventLedger', groupId, selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return null;
      const { data } = await eventsApi.getLedger(groupId, selectedEventId);
      return data.data;
    },
    enabled: !!selectedEventId,
  });

  const { register, handleSubmit, reset, setValue } = useForm({
    defaultValues: {
      name: '',
      description: '',
      eventType: 'trip',
      location: '',
      startsAt: '',
      endsAt: '',
      status: 'planned'
    },
  });

  // Sync attendance state when attendanceData is loaded or changed
  const initializeAttendanceState = (attendance, membersList) => {
    const state = {};
    membersList?.forEach((m) => {
      const existing = attendance?.find((a) => a.member_id === m.id);
      state[m.id] = {
        attended: existing ? existing.attended : true,
        mealsCount: existing ? existing.meals_count : 0,
      };
    });
    setAttendanceState(state);
  };

  const handleSelectEvent = (eventId) => {
    setSelectedEventId(eventId);
    setActiveSubTab(0);
    // Find event and sync attendance/ledger
    const currentEvent = events?.find((e) => e.id === eventId);
    if (currentEvent) {
      // Fetch attendance and initialize state
      eventsApi.getAttendance(groupId, eventId).then(({ data }) => {
        initializeAttendanceState(data.data, members);
      });
    }
  };

  const createMutation = useMutation({
    mutationFn: (data) => eventsApi.create(groupId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', groupId] });
      showToast('Event created successfully');
      setOpen(false);
      reset();
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => eventsApi.update(groupId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', groupId] });
      showToast('Event updated successfully');
      setOpen(false);
      setEditingEvent(null);
      reset();
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => eventsApi.delete(groupId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', groupId] });
      showToast('Event deleted successfully');
      if (selectedEventId === editingEvent?.id) {
        setSelectedEventId(null);
      }
      setOpen(false);
      setEditingEvent(null);
      reset();
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const saveAttendanceMutation = useMutation({
    mutationFn: (attendanceList) => eventsApi.saveAttendance(groupId, selectedEventId, attendanceList),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', groupId, selectedEventId] });
      queryClient.invalidateQueries({ queryKey: ['eventLedger', groupId, selectedEventId] });
      showToast('Attendance saved successfully');
    },
    onError: (err) => showToast(getErrorMessage(err), 'error'),
  });

  const onSubmit = (data) => {
    setError('');
    const formattedData = {
      ...data,
      startsAt: data.startsAt ? new Date(data.startsAt).toISOString() : null,
      endsAt: data.endsAt ? new Date(data.endsAt).toISOString() : null,
    };
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, data: formattedData });
    } else {
      createMutation.mutate(formattedData);
    }
  };

  const handleEditClick = (e, event) => {
    e.stopPropagation();
    setEditingEvent(event);
    setValue('name', event.name);
    setValue('description', event.description || '');
    setValue('eventType', event.event_type || 'trip');
    setValue('location', event.location || '');
    setValue('startsAt', event.starts_at ? dayjs(event.starts_at).format('YYYY-MM-DD') : '');
    setValue('endsAt', event.ends_at ? dayjs(event.ends_at).format('YYYY-MM-DD') : '');
    setValue('status', event.status || 'planned');
    setOpen(true);
  };

  const handleDeleteClick = (e, id) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this event? This cannot be undone.')) {
      deleteMutation.mutate(id);
    }
  };

  const handleAttendanceChange = (memberId, field, value) => {
    setAttendanceState((prev) => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        [field]: value,
      },
    }));
  };

  const handleSaveAttendance = () => {
    const list = Object.entries(attendanceState).map(([memberId, val]) => ({
      memberId,
      attended: val.attended,
      mealsCount: parseInt(val.mealsCount) || 0,
    }));
    saveAttendanceMutation.mutate(list);
  };

  const selectedEvent = events?.find((e) => e.id === selectedEventId);
  const eventExpenses = expenses?.filter((exp) => exp.event_id === selectedEventId) || [];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ color: 'text.primary' }}>
            Events & Trips
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage trips, group events, attendance checklist, and separate event-wise budgets.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setEditingEvent(null);
            reset({
              name: '',
              description: '',
              eventType: 'trip',
              location: '',
              startsAt: dayjs().format('YYYY-MM-DD'),
              endsAt: dayjs().add(2, 'day').format('YYYY-MM-DD'),
              status: 'planned'
            });
            setOpen(true);
          }}
          sx={{
            background: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
            boxShadow: '0 4px 14px 0 rgba(139, 92, 246, 0.4)',
            '&:hover': {
              background: 'linear-gradient(135deg, #7C3AED 0%, #DB2777 100%)',
            }
          }}
        >
          New Event / Trip
        </Button>
      </Box>

      {isEventsLoading ? (
        <Grid container spacing={2}>
          {[1, 2].map((i) => (
            <Grid size={{ xs: 12, md: 6 }} key={i}>
              <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 3 }} />
            </Grid>
          ))}
        </Grid>
      ) : events?.length === 0 ? (
        <Card sx={{ p: 6, textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)', border: '1px dashed rgba(139, 92, 246, 0.2)', borderRadius: 4 }}>
          <EventIcon sx={{ fontSize: 48, color: 'primary.light', mb: 2, opacity: 0.7 }} />
          <Typography variant="h6" fontWeight={600} gutterBottom>No events yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxW: 400, mx: 'auto', mb: 3 }}>
            Plan a weekend trip, a dinner party, or sports match. Track attendance and splits for that event.
          </Typography>
          <Button
            variant="outlined"
            onClick={() => setOpen(true)}
          >
            Create Your First Event
          </Button>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {/* Events List Left Column */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Stack spacing={2}>
              {events.map((event) => {
                const isActive = selectedEventId === event.id;
                return (
                  <Card
                    key={event.id}
                    onClick={() => handleSelectEvent(event.id)}
                    sx={{
                      cursor: 'pointer',
                      borderRadius: 3,
                      transition: 'all 0.2s ease',
                      border: isActive ? '2px solid #8B5CF6' : '1px solid rgba(255, 255, 255, 0.05)',
                      boxShadow: isActive ? '0 8px 24px -4px rgba(139, 92, 246, 0.15)' : 'none',
                      bgcolor: isActive ? 'rgba(139, 92, 246, 0.02)' : 'background.paper',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 8px 20px -6px rgba(0, 0, 0, 0.15)',
                        borderColor: isActive ? '#8B5CF6' : 'rgba(139, 92, 246, 0.3)',
                      }
                    }}
                  >
                    <CardContent sx={{ p: 2.5 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Stack spacing={0.5}>
                          <Typography variant="h6" fontWeight={700} color={isActive ? 'primary.main' : 'text.primary'}>
                            {event.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: '280px' }}>
                            {event.description || 'No description provided'}
                          </Typography>
                        </Stack>
                        <Stack direction="row" spacing={0.5}>
                          <IconButton size="small" onClick={(e) => handleEditClick(e, event)}><EditIcon fontSize="small" /></IconButton>
                          <IconButton size="small" color="error" onClick={(e) => handleDeleteClick(e, event.id)}><DeleteIcon fontSize="small" /></IconButton>
                        </Stack>
                      </Box>

                      <Stack direction="row" spacing={1} mt={2} flexWrap="wrap" gap={1}>
                        <Chip
                          label={event.event_type}
                          size="small"
                          sx={{ textTransform: 'capitalize', bgcolor: 'rgba(139, 92, 246, 0.08)', color: 'primary.light', fontWeight: 600 }}
                        />
                        <Chip
                          label={event.status}
                          size="small"
                          color={event.status === 'completed' ? 'success' : event.status === 'active' ? 'primary' : 'default'}
                          variant={event.status === 'active' ? 'filled' : 'outlined'}
                        />
                      </Stack>

                      <Divider sx={{ my: 1.5, opacity: 0.5 }} />

                      <Box display="flex" justifyContent="space-between" alignItems="center" color="text.secondary">
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <CalendarMonthIcon sx={{ fontSize: 16 }} />
                          <Typography variant="caption">
                            {event.starts_at ? dayjs(event.starts_at).format('MMM D') : 'TBD'}
                            {event.ends_at && ` - ${dayjs(event.ends_at).format('MMM D, YYYY')}`}
                          </Typography>
                        </Box>
                        {event.location && (
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <LocationOnIcon sx={{ fontSize: 16 }} />
                            <Typography variant="caption" noWrap sx={{ maxWidth: 100 }}>{event.location}</Typography>
                          </Box>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          </Grid>

          {/* Details / Interactive Worksheets Right Column */}
          <Grid size={{ xs: 12, md: 7 }}>
            {selectedEventId && selectedEvent ? (
              <Box>
                <Card sx={{ borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  {/* Event Detail Header Banner */}
                  <Box
                    sx={{
                      p: 3,
                      background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(236, 72, 153, 0.05) 100%)',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
                    }}
                  >
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="h5" fontWeight={800} gutterBottom>
                          {selectedEvent.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {selectedEvent.description}
                        </Typography>
                      </Box>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => navigate(`/groups/${groupId}/expenses/new?eventId=${selectedEventId}`)}
                      >
                        Add Expense
                      </Button>
                    </Box>
                  </Box>

                  <Tabs
                    value={activeSubTab}
                    onChange={(_, val) => setActiveSubTab(val)}
                    sx={{ borderBottom: 1, borderColor: 'divider' }}
                  >
                    <Tab label="Attendance & Meals" icon={<RestaurantMenuIcon />} iconPosition="start" />
                    <Tab label="Event Ledger" icon={<EventIcon />} iconPosition="start" />
                    <Tab label={`Expenses (${eventExpenses.length})`} icon={<ReceiptLongIcon />} iconPosition="start" />
                  </Tabs>

                  <Box sx={{ p: 3 }}>
                    {/* Tab 0: Attendance Checklist */}
                    {activeSubTab === 0 && (
                      <Box>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                          <Typography variant="subtitle1" fontWeight={700}>
                            Event Participation List
                          </Typography>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<SaveIcon />}
                            onClick={handleSaveAttendance}
                            disabled={saveAttendanceMutation.isPending}
                          >
                            {saveAttendanceMutation.isPending ? 'Saving...' : 'Save Attendance'}
                          </Button>
                        </Box>

                        {isAttendanceLoading ? (
                          <Skeleton variant="rectangular" height={200} />
                        ) : (
                          <Stack spacing={1.5}>
                            {members?.map((member) => {
                              const state = attendanceState[member.id] || { attended: true, mealsCount: 0 };
                              return (
                                <Box
                                  key={member.id}
                                  display="flex"
                                  alignItems="center"
                                  justifyContent="space-between"
                                  sx={{
                                    p: 1.5,
                                    borderRadius: 2,
                                    border: '1px solid rgba(255, 255, 255, 0.04)',
                                    bgcolor: 'rgba(255, 255, 255, 0.01)',
                                    transition: 'all 0.2s',
                                    '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.03)' }
                                  }}
                                >
                                  <Box display="flex" alignItems="center" gap={1.5}>
                                    <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.85rem' }}>
                                      {member.full_name?.charAt(0)}
                                    </Avatar>
                                    <Typography fontWeight={500}>{member.full_name}</Typography>
                                  </Box>

                                  <Box display="flex" alignItems="center" gap={3}>
                                    <FormControlLabel
                                      control={
                                        <Checkbox
                                          checked={state.attended}
                                          onChange={(e) => handleAttendanceChange(member.id, 'attended', e.target.checked)}
                                        />
                                      }
                                      label="Attended"
                                    />
                                    {selectedEvent.event_type === 'food_club' && state.attended && (
                                      <TextField
                                        label="Meals"
                                        type="number"
                                        size="small"
                                        value={state.mealsCount}
                                        onChange={(e) => handleAttendanceChange(member.id, 'mealsCount', parseInt(e.target.value) || 0)}
                                        sx={{ width: 80 }}
                                      />
                                    )}
                                  </Box>
                                </Box>
                              );
                            })}
                          </Stack>
                        )}
                      </Box>
                    )}

                    {/* Tab 1: Event Ledger */}
                    {activeSubTab === 1 && (
                      <Box>
                        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                          Event-Specific Debt Matrix
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                          These balances are calculated solely based on expenses linked to <strong>{selectedEvent.name}</strong>.
                        </Typography>

                        {isLedgerLoading ? (
                          <Skeleton variant="rectangular" height={150} />
                        ) : !ledgerData?.suggestedSettlements || ledgerData.suggestedSettlements.length === 0 ? (
                          <Alert severity="info" sx={{ borderRadius: 3 }}>
                            No outstanding balances or expenses recorded for this event.
                          </Alert>
                        ) : (
                          <Grid container spacing={2}>
                            <Grid size={{ xs: 12, md: 5 }}>
                              <Typography variant="subtitle2" fontWeight={600} gutterBottom>Event Balances</Typography>
                              <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                                {ledgerData.balances.map((b) => (
                                  <Box key={b.member_id} display="flex" justifyContent="space-between" py={1}>
                                    <Typography variant="body2">{b.full_name}</Typography>
                                    <Typography
                                      variant="body2"
                                      fontWeight={700}
                                      color={b.balance > 0 ? 'success.main' : b.balance < 0 ? 'error.main' : 'text.secondary'}
                                    >
                                      {b.balance > 0 ? '+' : ''}{formatCurrency(b.balance, group?.currency)}
                                    </Typography>
                                  </Box>
                                ))}
                              </Paper>
                            </Grid>
                            <Grid size={{ xs: 12, md: 7 }}>
                              <Typography variant="subtitle2" fontWeight={600} gutterBottom>Optimized Settlements</Typography>
                              <Stack spacing={1.5}>
                                {ledgerData.suggestedSettlements.map((s, idx) => (
                                  <Box
                                    key={idx}
                                    display="flex"
                                    alignItems="center"
                                    justifyContent="space-between"
                                    sx={{
                                      p: 2,
                                      borderRadius: 3,
                                      border: '1px solid rgba(139, 92, 246, 0.1)',
                                      bgcolor: 'rgba(139, 92, 246, 0.01)'
                                    }}
                                  >
                                    <Box display="flex" alignItems="center" gap={1.5}>
                                      <Typography fontWeight={600} variant="body2">{s.fromName}</Typography>
                                      <ArrowForwardIcon sx={{ color: 'primary.main', fontSize: 16 }} />
                                      <Typography fontWeight={600} variant="body2">{s.toName}</Typography>
                                    </Box>
                                    <Typography fontWeight={700} color="primary.light">
                                      {formatCurrency(s.amount, group?.currency)}
                                    </Typography>
                                  </Box>
                                ))}
                              </Stack>
                            </Grid>
                          </Grid>
                        )}
                      </Box>
                    )}

                    {/* Tab 2: Expenses List */}
                    {activeSubTab === 2 && (
                      <Box>
                        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                          Linked Expenses
                        </Typography>
                        {eventExpenses.length === 0 ? (
                          <Alert severity="info" sx={{ borderRadius: 3 }}>
                            No expenses are linked to this event. Open an expense and set the event link, or add a new one from this event.
                          </Alert>
                        ) : (
                          <Stack spacing={1.5}>
                            {eventExpenses.map((exp) => (
                              <Box
                                key={exp.id}
                                display="flex"
                                justifyContent="space-between"
                                alignItems="center"
                                sx={{
                                  p: 2,
                                  borderRadius: 3,
                                  border: '1px solid rgba(255, 255, 255, 0.05)',
                                  bgcolor: 'rgba(255, 255, 255, 0.01)'
                                }}
                              >
                                <Box>
                                  <Typography fontWeight={600} variant="body2">{exp.title}</Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    Paid by {exp.paid_by_name} on {dayjs(exp.expense_date).format('MMM DD, YYYY')}
                                  </Typography>
                                </Box>
                                <Typography fontWeight={700} color="primary.main">
                                  {formatCurrency(parseFloat(exp.amount), group?.currency)}
                                </Typography>
                              </Box>
                            ))}
                          </Stack>
                        )}
                      </Box>
                    )}
                  </Box>
                </Card>
              </Box>
            ) : (
              <Card sx={{ p: 6, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <EventIcon sx={{ fontSize: 64, color: 'divider', mb: 2 }} />
                <Typography color="text.secondary">Select an event from the list to view attendance sheets and ledger debt calculations.</Typography>
              </Card>
            )}
          </Grid>
        </Grid>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingEvent ? 'Edit Event / Trip' : 'Create New Event / Trip'}</DialogTitle>
        <Box component="form" onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <TextField fullWidth label="Event Name" margin="normal" required {...register('name')} />
            <TextField fullWidth label="Description" margin="normal" multiline rows={2} {...register('description')} />
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth select label="Event Type" {...register('eventType')}>
                  <MenuItem value="trip">Trip / Vacation</MenuItem>
                  <MenuItem value="dinner">Dinner / Food Event</MenuItem>
                  <MenuItem value="match">Sports Match</MenuItem>
                  <MenuItem value="food_club">Food Club Routine</MenuItem>
                  <MenuItem value="general">Other / General</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth select label="Status" {...register('status')}>
                  <MenuItem value="planned">Planned</MenuItem>
                  <MenuItem value="active">Active / In Progress</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField fullWidth label="Location" {...register('location')} />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField fullWidth label="Start Date" type="date" InputLabelProps={{ shrink: true }} {...register('startsAt')} />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField fullWidth label="End Date" type="date" InputLabelProps={{ shrink: true }} {...register('endsAt')} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={createMutation.isPending || updateMutation.isPending}>
              {editingEvent ? 'Save Changes' : 'Create Event'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
