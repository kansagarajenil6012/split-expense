import { useState, useEffect } from 'react';
import { useParams, useOutletContext, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Grid2 as Grid, Card, CardContent,
  TextField, MenuItem, Checkbox, FormControlLabel, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, Tabs, Tab,
  Alert, Divider, Stack, InputAdornment, Avatar
} from '@mui/material';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import SportsCricketIcon from '@mui/icons-material/SportsCricket';
import SendIcon from '@mui/icons-material/Send';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { groupsApi, expensesApi } from '../../services/api.js';
import { formatCurrency } from '../../utils/formatters.js';
import { getErrorMessage } from '../../services/api-client.js';
import { useUIStore } from '../../store/ui.store.js';
import dayjs from 'dayjs';

export default function ClubPage() {
  const { groupId } = useParams();
  const { group } = useOutletContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const showToast = useUIStore((s) => s.showToast);

  // Determine active club tab based on group type
  const initialTab = group?.group_type === 'sports' ? 1 : 0;
  const [activeTab, setActiveTab] = useState(initialTab);
  const [error, setError] = useState('');

  const { data: members, isLoading: isMembersLoading } = useQuery({
    queryKey: ['members', groupId],
    queryFn: async () => {
      const { data } = await groupsApi.getMembers(groupId);
      return data.data;
    },
  });

  // ---------------- FOOD CLUB STATE & FORM ----------------
  const [mealCheckins, setMealCheckins] = useState({});
  const [costPerMeal, setCostPerMeal] = useState(120);
  const [foodBillTitle, setFoodBillTitle] = useState(`Meal Check-ins (${dayjs().format('MMM DD')})`);
  const [foodPaidBy, setFoodPaidBy] = useState('');

  useEffect(() => {
    if (members) {
      const initial = {};
      members.forEach((m) => {
        initial[m.id] = { breakfast: false, lunch: false, dinner: false };
      });
      setMealCheckins(initial);
      if (members.length > 0) {
        setFoodPaidBy(members[0].id);
      }
    }
  }, [members]);

  const handleMealToggle = (memberId, mealType) => {
    setMealCheckins((prev) => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        [mealType]: !prev[memberId][mealType],
      },
    }));
  };

  const getMealsCount = (memberId) => {
    const checkin = mealCheckins[memberId];
    if (!checkin) return 0;
    return (checkin.breakfast ? 1 : 0) + (checkin.lunch ? 1 : 0) + (checkin.dinner ? 1 : 0);
  };

  const getTotalMeals = () => {
    return Object.keys(mealCheckins).reduce((sum, memberId) => sum + getMealsCount(memberId), 0);
  };

  const postFoodExpenseMutation = useMutation({
    mutationFn: (data) => expensesApi.create(groupId, data),
    onSuccess: () => {
      showToast('Meal check-ins posted as expense successfully');
      queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
      queryClient.invalidateQueries({ queryKey: ['balances', groupId] });
      navigate(`/groups/${groupId}/expenses`);
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const handlePostFoodExpense = () => {
    setError('');
    const totalMeals = getTotalMeals();
    if (totalMeals === 0) {
      setError('Please check-in at least one meal to post an expense.');
      return;
    }
    if (!foodPaidBy) {
      setError('Please select who paid for the meals.');
      return;
    }

    const totalBill = totalMeals * costPerMeal;
    const participants = Object.entries(mealCheckins)
      .map(([memberId, checkin]) => {
        const count = getMealsCount(memberId);
        return {
          memberId,
          isIncluded: count > 0,
          shareAmount: count * costPerMeal,
        };
      })
      .filter((p) => p.isIncluded);

    postFoodExpenseMutation.mutate({
      title: foodBillTitle,
      amount: totalBill,
      expenseDate: dayjs().format('YYYY-MM-DD'),
      paidByMemberId: foodPaidBy,
      splitType: 'unequal',
      description: `Auto-generated meal split. Total meals consumed: ${totalMeals} at ${formatCurrency(costPerMeal, group?.currency)} per meal.`,
      participants,
    });
  };

  // ---------------- SPORTS CLUB STATE & FORM ----------------
  const [playingMembers, setPlayingMembers] = useState({});
  const [sportsFeeTitle, setSportsFeeTitle] = useState(`Match Court Booking (${dayjs().format('MMM DD')})`);
  const [sportsPaidBy, setSportsPaidBy] = useState('');
  const [totalSportsFee, setTotalSportsFee] = useState(1500);

  useEffect(() => {
    if (members) {
      const initial = {};
      members.forEach((m) => {
        initial[m.id] = true; // default all playing
      });
      setPlayingMembers(initial);
      if (members.length > 0) {
        setSportsPaidBy(members[0].id);
      }
    }
  }, [members]);

  const handlePlayingToggle = (memberId) => {
    setPlayingMembers((prev) => ({
      ...prev,
      [memberId]: !prev[memberId],
    }));
  };

  const getPlayingCount = () => {
    return Object.values(playingMembers).filter(Boolean).length;
  };

  const postSportsExpenseMutation = useMutation({
    mutationFn: (data) => expensesApi.create(groupId, data),
    onSuccess: () => {
      showToast('Match fees posted as expense successfully');
      queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
      queryClient.invalidateQueries({ queryKey: ['balances', groupId] });
      navigate(`/groups/${groupId}/expenses`);
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const handlePostSportsExpense = () => {
    setError('');
    const playingCount = getPlayingCount();
    if (playingCount === 0) {
      setError('Please select at least one playing member to distribute fees.');
      return;
    }
    if (!sportsPaidBy) {
      setError('Please select who paid the match fee.');
      return;
    }
    if (totalSportsFee <= 0) {
      setError('Please enter a valid booking fee.');
      return;
    }

    const shareAmount = parseFloat((totalSportsFee / playingCount).toFixed(2));
    const participants = Object.entries(playingMembers)
      .map(([memberId, isPlaying]) => ({
        memberId,
        isIncluded: isPlaying,
        shareAmount,
      }))
      .filter((p) => p.isIncluded);

    postSportsExpenseMutation.mutate({
      title: sportsFeeTitle,
      amount: totalSportsFee,
      expenseDate: dayjs().format('YYYY-MM-DD'),
      paidByMemberId: sportsPaidBy,
      splitType: 'equal',
      description: `Auto-generated sports match fee split. booking split equally among ${playingCount} players.`,
      participants,
    });
  };

  return (
    <Box>
      <Box mb={3}>
        <Typography variant="h5" fontWeight={700}>
          Club Utilities
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Specialized split engines for Food Clubs (meal check-ins) and Sports Clubs (match rosters & booking fee shares).
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Tabs
        value={activeTab}
        onChange={(_, val) => setActiveTab(val)}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
      >
        <Tab label="Food Club Meal Tracker" icon={<RestaurantIcon />} iconPosition="start" />
        <Tab label="Sports Match Sheet" icon={<SportsCricketIcon />} iconPosition="start" />
      </Tabs>

      {/* Tab 0: Food Club Meal Tracker */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, lg: 8 }}>
            <Card sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Daily Meal Check-In Sheet
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Select the meals consumed by members today to calculate proportional cost distribution.
                </Typography>

                {isMembersLoading ? (
                  <Skeleton variant="rectangular" height={200} />
                ) : (
                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Member Name</TableCell>
                          <TableCell align="center">Breakfast</TableCell>
                          <TableCell align="center">Lunch</TableCell>
                          <TableCell align="center">Dinner</TableCell>
                          <TableCell align="center">Total Meals</TableCell>
                          <TableCell align="right">Share Value</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {members?.map((m) => {
                          const checkin = mealCheckins[m.id] || { breakfast: false, lunch: false, dinner: false };
                          const mealsCount = getMealsCount(m.id);
                          const memberShare = mealsCount * costPerMeal;
                          return (
                            <TableRow key={m.id}>
                              <TableCell fontWeight={600}>
                                <Stack direction="row" alignItems="center" spacing={1.5}>
                                  <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main', fontSize: '0.8rem' }}>
                                    {m.full_name?.charAt(0)}
                                  </Avatar>
                                  <Typography variant="body2">{m.full_name}</Typography>
                                </Stack>
                              </TableCell>
                              <TableCell align="center">
                                <Checkbox
                                  checked={checkin.breakfast}
                                  onChange={() => handleMealToggle(m.id, 'breakfast')}
                                />
                              </TableCell>
                              <TableCell align="center">
                                <Checkbox
                                  checked={checkin.lunch}
                                  onChange={() => handleMealToggle(m.id, 'lunch')}
                                />
                              </TableCell>
                              <TableCell align="center">
                                <Checkbox
                                  checked={checkin.dinner}
                                  onChange={() => handleMealToggle(m.id, 'dinner')}
                                />
                              </TableCell>
                              <TableCell align="center">
                                <Chip label={mealsCount} size="small" color={mealsCount > 0 ? 'primary' : 'default'} />
                              </TableCell>
                              <TableCell align="right" fontWeight={700}>
                                {formatCurrency(memberShare, group?.currency)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, lg: 4 }}>
            <Card sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Post Meal Expense
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Convert the checked-in meals into a group expense in one click.
                </Typography>

                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    label="Expense Title"
                    value={foodBillTitle}
                    onChange={(e) => setFoodBillTitle(e.target.value)}
                  />

                  <TextField
                    fullWidth
                    label="Cost Per Meal"
                    type="number"
                    value={costPerMeal}
                    onChange={(e) => setCostPerMeal(parseFloat(e.target.value) || 0)}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">{group?.currency}</InputAdornment>,
                    }}
                  />

                  <TextField
                    fullWidth
                    select
                    label="Paid By"
                    value={foodPaidBy}
                    onChange={(e) => setFoodPaidBy(e.target.value)}
                  >
                    {members?.map((m) => (
                      <MenuItem key={m.id} value={m.id}>{m.full_name}</MenuItem>
                    ))}
                  </TextField>

                  <Divider sx={{ my: 1 }} />

                  <Box display="flex" justifyContent="space-between" py={0.5}>
                    <Typography color="text.secondary">Total Meals Booked:</Typography>
                    <Typography fontWeight={700}>{getTotalMeals()}</Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" py={0.5}>
                    <Typography color="text.secondary">Total Expense Amount:</Typography>
                    <Typography fontWeight={800} color="primary.main" variant="h6">
                      {formatCurrency(getTotalMeals() * costPerMeal, group?.currency)}
                    </Typography>
                  </Box>

                  <Button
                    variant="contained"
                    fullWidth
                    startIcon={<SendIcon />}
                    onClick={handlePostFoodExpense}
                    disabled={postFoodExpenseMutation.isPending}
                    sx={{ mt: 1 }}
                  >
                    {postFoodExpenseMutation.isPending ? 'Posting...' : 'Post Group Expense'}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tab 1: Sports Match Sheet */}
      {activeTab === 1 && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, lg: 8 }}>
            <Card sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Match Roster & Playing Register
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Select the players who played in today's match. The booking/ground fees will be divided equally only among them.
                </Typography>

                {isMembersLoading ? (
                  <Skeleton variant="rectangular" height={200} />
                ) : (
                  <Grid container spacing={2}>
                    {members?.map((m) => {
                      const isPlaying = playingMembers[m.id] ?? false;
                      const shareVal = isPlaying && getPlayingCount() > 0 ? (totalSportsFee / getPlayingCount()) : 0;
                      return (
                        <Grid size={{ xs: 12, sm: 6 }} key={m.id}>
                          <Box
                            display="flex"
                            alignItems="center"
                            justifyContent="space-between"
                            sx={{
                              p: 2,
                              borderRadius: 3,
                              border: '1px solid',
                              borderColor: isPlaying ? 'primary.light' : 'rgba(255, 255, 255, 0.05)',
                              bgcolor: isPlaying ? 'rgba(139, 92, 246, 0.02)' : 'rgba(255, 255, 255, 0.01)',
                              transition: 'all 0.2s',
                              cursor: 'pointer',
                              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.03)' }
                            }}
                            onClick={() => handlePlayingToggle(m.id)}
                          >
                            <Box display="flex" alignItems="center" gap={1.5}>
                              <Avatar sx={{ width: 32, height: 32, bgcolor: isPlaying ? 'primary.main' : 'divider' }}>
                                {m.full_name?.charAt(0)}
                              </Avatar>
                              <Box>
                                <Typography fontWeight={600} variant="body2">{m.full_name}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {isPlaying ? 'Playing Roster' : 'Not Playing'}
                                </Typography>
                              </Box>
                            </Box>
                            {isPlaying ? (
                              <CheckCircleIcon color="primary" />
                            ) : (
                              <Box sx={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)' }} />
                            )}
                          </Box>
                        </Grid>
                      );
                    })}
                  </Grid>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, lg: 4 }}>
            <Card sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Post Match Fee Bill
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Evenly distribute court/ground booking expenses among active playing members.
                </Typography>

                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    label="Expense Title"
                    value={sportsFeeTitle}
                    onChange={(e) => setSportsFeeTitle(e.target.value)}
                  />

                  <TextField
                    fullWidth
                    label="Ground / Court Booking Fee"
                    type="number"
                    value={totalSportsFee}
                    onChange={(e) => setTotalSportsFee(parseFloat(e.target.value) || 0)}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">{group?.currency}</InputAdornment>,
                    }}
                  />

                  <TextField
                    fullWidth
                    select
                    label="Paid By"
                    value={sportsPaidBy}
                    onChange={(e) => setSportsPaidBy(e.target.value)}
                  >
                    {members?.map((m) => (
                      <MenuItem key={m.id} value={m.id}>{m.full_name}</MenuItem>
                    ))}
                  </TextField>

                  <Divider sx={{ my: 1 }} />

                  <Box display="flex" justifyContent="space-between" py={0.5}>
                    <Typography color="text.secondary">Players Sharing Fee:</Typography>
                    <Typography fontWeight={700}>{getPlayingCount()}</Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" py={0.5}>
                    <Typography color="text.secondary">Cost Per Player:</Typography>
                    <Typography fontWeight={800} color="primary.main" variant="subtitle1">
                      {formatCurrency(getPlayingCount() > 0 ? (totalSportsFee / getPlayingCount()) : 0, group?.currency)}
                    </Typography>
                  </Box>

                  <Button
                    variant="contained"
                    fullWidth
                    startIcon={<SendIcon />}
                    onClick={handlePostSportsExpense}
                    disabled={postSportsExpenseMutation.isPending}
                    sx={{ mt: 1 }}
                  >
                    {postSportsExpenseMutation.isPending ? 'Posting...' : 'Post Match Expense'}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
