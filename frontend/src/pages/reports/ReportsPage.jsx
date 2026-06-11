import { useState } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import {
  Box, Grid2 as Grid, Card, CardContent, Typography, Skeleton,
  Table, TableBody, TableCell, TableHead, TableRow, Chip, LinearProgress, Stack,
  Tabs, Tab, TableContainer, Paper, Divider, Alert
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { reportsApi, budgetsApi } from '../../services/api.js';
import { formatCurrency } from '../../utils/formatters.js';
import dayjs from 'dayjs';
import {
  PieChart as PieIcon,
  BarChart as BarIcon,
  ShowChart as TrendsIcon,
  AccountBalanceWallet as BudgetIcon,
  Savings as SavingsIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  InfoOutlined as InfoIcon,
  DateRange as DateRangeIcon
} from '@mui/icons-material';

// --- Custom Donut Chart Component ---
function DonutChart({ data, currency }) {
  const total = data.reduce((sum, item) => sum + parseFloat(item.total_amount || 0), 0);
  const size = 200;
  const radius = 70;
  const strokeWidth = 22;
  const circumference = 2 * Math.PI * radius;
  
  let currentOffset = 0;
  const colors = [
    '#6366f1', // Indigo
    '#14b8a6', // Teal
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#3b82f6', // Blue
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#10b981', // Emerald
  ];

  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (total === 0) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height={220}>
        <Typography color="text.secondary" variant="body2">No category data</Typography>
      </Box>
    );
  }

  return (
    <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} alignItems="center" gap={3} justifyContent="center">
      <Box position="relative" width={size} height={size} display="flex" justifyContent="center" alignItems="center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {data.map((item, idx) => {
            const val = parseFloat(item.total_amount || 0);
            const percentage = (val / total) * 100;
            const strokeDashoffset = circumference - (percentage / 100) * circumference;
            const color = colors[idx % colors.length];
            const rotation = (currentOffset / total) * 360 - 90;
            currentOffset += val;

            const isHovered = hoveredIdx === idx;

            return (
              <circle
                key={idx}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={color}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={strokeDashoffset}
                transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
                style={{
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  cursor: 'pointer',
                }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          })}
        </svg>
        <Box
          position="absolute"
          sx={{
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          {hoveredIdx !== null ? (
            <>
              <Typography variant="caption" color="text.secondary" fontWeight={500} display="block">
                {data[hoveredIdx].category}
              </Typography>
              <Typography variant="subtitle2" fontWeight={700}>
                {formatCurrency(parseFloat(data[hoveredIdx].total_amount || 0), currency)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {Math.round((parseFloat(data[hoveredIdx].total_amount || 0) / total) * 100)}%
              </Typography>
            </>
          ) : (
            <>
              <Typography variant="caption" color="text.secondary" fontWeight={500} display="block">
                Total Spends
              </Typography>
              <Typography variant="subtitle1" fontWeight={700}>
                {formatCurrency(total, currency)}
              </Typography>
            </>
          )}
        </Box>
      </Box>

      {/* Legend list */}
      <Box display="flex" flexDirection="column" gap={1} flex={1} width="100%">
        {data.map((item, idx) => {
          const color = colors[idx % colors.length];
          const val = parseFloat(item.total_amount || 0);
          const pct = Math.round((val / total) * 100);
          return (
            <Box
              key={idx}
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              p={0.5}
              borderRadius={1}
              bgcolor={hoveredIdx === idx ? 'action.hover' : 'transparent'}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              sx={{ cursor: 'pointer', transition: 'background-color 0.2s' }}
            >
              <Box display="flex" alignItems="center" gap={1}>
                <Box width={10} height={10} borderRadius="50%" bgcolor={color} />
                <Typography variant="body2" fontSize={13} fontWeight={hoveredIdx === idx ? 600 : 400}>
                  {item.category}
                </Typography>
              </Box>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="body2" fontSize={13} fontWeight={600}>
                  {formatCurrency(val, currency)}
                </Typography>
                <Typography variant="caption" color="text.secondary" width={30} align="right">
                  {pct}%
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// --- Custom Trend Area Chart Component ---
function TrendAreaChart({ data, currency }) {
  const height = 140;
  const paddingLeft = 45;
  const paddingRight = 15;
  const paddingTop = 15;
  const paddingBottom = 25;
  const svgHeight = height + paddingTop + paddingBottom;

  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (!data || data.length === 0) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" height={svgHeight}>
        <Typography color="text.secondary" variant="body2">No trends data</Typography>
      </Box>
    );
  }

  const maxVal = Math.max(...data.map(d => parseFloat(d.total_amount || 0)), 100);
  const chartWidth = 500;
  const svgWidth = chartWidth + paddingLeft + paddingRight;

  const points = data.map((item, idx) => {
    const val = parseFloat(item.total_amount || 0);
    const x = paddingLeft + (idx / Math.max(data.length - 1, 1)) * chartWidth;
    const y = paddingTop + height - (val / maxVal) * height;
    return { x, y, ...item, parsed_total_amount: val };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x} ${paddingTop + height} L ${points[0].x} ${paddingTop + height} Z`
    : '';

  return (
    <Box position="relative" width="100%">
      <svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Y Axis Gridlines & Labels */}
        {[0, 0.5, 1].map((ratio, idx) => {
          const y = paddingTop + height - ratio * height;
          const val = ratio * maxVal;
          return (
            <g key={idx}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={paddingLeft + chartWidth}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={paddingLeft - 8}
                y={y + 3}
                textAnchor="end"
                fill="#94a3b8"
                fontSize={10}
              >
                {formatCurrency(Math.round(val), currency)}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        {areaPath && <path d={areaPath} fill="url(#areaGrad)" />}

        {/* Trend Line */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="#6366f1"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Points & Interactive Zones */}
        {points.map((p, idx) => {
          const isHovered = hoveredIdx === idx;
          return (
            <g key={idx}>
              {isHovered && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={8}
                  fill="#6366f1"
                  fillOpacity={0.25}
                />
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={isHovered ? 5 : 4}
                fill={isHovered ? '#6366f1' : '#ffffff'}
                stroke="#6366f1"
                strokeWidth={2.5}
                style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
              <text
                x={p.x}
                y={paddingTop + height + 16}
                textAnchor="middle"
                fill="#64748b"
                fontSize={10}
                fontWeight={isHovered ? 600 : 400}
              >
                {dayjs(p.month).format('MMM')}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Hover Tooltip card */}
      {hoveredIdx !== null && (
        <Card
          sx={{
            position: 'absolute',
            top: Math.max(0, points[hoveredIdx].y - 65),
            left: `${((points[hoveredIdx].x - paddingLeft) / chartWidth) * 85 + 10}%`,
            transform: 'translateX(-50%)',
            boxShadow: 3,
            p: 1,
            zIndex: 10,
            pointerEvents: 'none',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="caption" color="text.secondary" display="block">
            {dayjs(points[hoveredIdx].month).format('MMMM YYYY')}
          </Typography>
          <Typography variant="body2" fontWeight={700}>
            {formatCurrency(points[hoveredIdx].parsed_total_amount, currency)}
          </Typography>
          <Typography variant="caption" color="primary" display="block">
            {points[hoveredIdx].expense_count} expenses
          </Typography>
        </Card>
      )}
    </Box>
  );
}

// --- Custom Spender Paid vs Spent Bar Chart ---
function SpendersBarChart({ data, currency }) {
  if (!data || data.length === 0) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" height={150}>
        <Typography color="text.secondary" variant="body2">No member data</Typography>
      </Box>
    );
  }

  const maxVal = Math.max(...data.map(d => Math.max(parseFloat(d.total_paid || 0), parseFloat(d.total_owed || 0))), 1);

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      {data.map((m, idx) => {
        const paidVal = parseFloat(m.total_paid || 0);
        const owedVal = parseFloat(m.total_owed || 0);
        const paidPct = (paidVal / maxVal) * 100;
        const owedPct = (owedVal / maxVal) * 100;
        
        return (
          <Box key={m.member_id || idx} display="flex" flexDirection="column" gap={0.5}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" fontWeight={600} fontSize={13}>{m.full_name}</Typography>
              <Box display="flex" gap={2}>
                <Typography variant="caption" color="primary.main" fontWeight={500}>
                  Paid: {formatCurrency(paidVal, currency)}
                </Typography>
                <Typography variant="caption" color="secondary.main" fontWeight={500}>
                  Spent: {formatCurrency(owedVal, currency)}
                </Typography>
              </Box>
            </Box>

            <Box position="relative" width="100%" height={14} bgcolor="action.hover" borderRadius={1} overflow="hidden">
              {/* Paid Bar (Indigo) */}
              <Box
                position="absolute"
                top={0}
                left={0}
                height="50%"
                width={`${paidPct}%`}
                sx={{
                  background: 'linear-gradient(90deg, #6366f1 0%, #818cf8 100%)',
                  borderRadius: '0 3px 3px 0',
                  transition: 'width 0.8s ease-out',
                }}
              />
              {/* Spent/Owed Bar (Teal) */}
              <Box
                position="absolute"
                bottom={0}
                left={0}
                height="50%"
                width={`${owedPct}%`}
                sx={{
                  background: 'linear-gradient(90deg, #14b8a6 0%, #2dd4bf 100%)',
                  borderRadius: '0 3px 3px 0',
                  transition: 'width 0.8s ease-out',
                }}
              />
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

// --- Custom Yearly Bar Chart Component ---
function YearlyBarChart({ data, currency }) {
  if (!data || data.length === 0) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" height={200}>
        <Typography color="text.secondary" variant="body2">No yearly data</Typography>
      </Box>
    );
  }
  const maxVal = Math.max(...data.map(d => parseFloat(d.total_amount || 0)), 100);
  const height = 180;
  const barWidth = 50;
  const gap = 30;
  const paddingLeft = 50;
  const paddingBottom = 40;
  const paddingTop = 20;
  
  const chartWidth = Math.max(data.length * (barWidth + gap), 300);
  const svgWidth = chartWidth + paddingLeft + 20;
  const svgHeight = height + paddingBottom + paddingTop;

  return (
    <Box overflow="auto" width="100%" sx={{ py: 2 }}>
      <svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
        </defs>

        {/* Gridlines */}
        {[0, 0.5, 1].map((ratio, idx) => {
          const y = paddingTop + height - ratio * height;
          const val = ratio * maxVal;
          return (
            <g key={idx}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={paddingLeft + chartWidth}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={paddingLeft - 8}
                y={y + 3}
                textAnchor="end"
                fill="#94a3b8"
                fontSize={10}
              >
                {formatCurrency(Math.round(val), currency)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((item, idx) => {
          const val = parseFloat(item.total_amount || 0);
          const barHeight = (val / maxVal) * height;
          const x = paddingLeft + idx * (barWidth + gap) + gap / 2;
          const y = paddingTop + height - barHeight;

          return (
            <g key={idx}>
              {/* Bar */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 4)} // Ensure at least a sliver is visible
                fill="url(#barGrad)"
                rx={6}
                style={{ transition: 'all 0.5s ease-out' }}
              />
              {/* Label below bar */}
              <text
                x={x + barWidth / 2}
                y={paddingTop + height + 22}
                textAnchor="middle"
                fill="#64748b"
                fontSize={12}
                fontWeight={600}
              >
                {item.year}
              </text>
              {/* Value on top of bar */}
              <text
                x={x + barWidth / 2}
                y={y - 8}
                textAnchor="middle"
                fill="#1e293b"
                fontSize={11}
                fontWeight={700}
              >
                {formatCurrency(val, currency)}
              </text>
              {/* Expense count */}
              <text
                x={x + barWidth / 2}
                y={paddingTop + height + 36}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize={10}
              >
                {item.expense_count} expenses
              </text>
            </g>
          );
        })}
      </svg>
    </Box>
  );
}

// --- Main Reports Dashboard Page ---
export default function ReportsPage() {
  const { groupId } = useParams();
  const { group } = useOutletContext();
  const [activeTab, setActiveTab] = useState(0);

  // Queries
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['reports', 'summary', groupId],
    queryFn: async () => {
      const { data } = await reportsApi.summary(groupId);
      return data.data;
    },
  });

  const { data: memberReport } = useQuery({
    queryKey: ['reports', 'members', groupId],
    queryFn: async () => {
      const { data } = await reportsApi.members(groupId);
      return data.data;
    },
  });

  const { data: categoryReport } = useQuery({
    queryKey: ['reports', 'categories', groupId],
    queryFn: async () => {
      const { data } = await reportsApi.categories(groupId);
      return data.data;
    },
  });

  const { data: monthlyReport } = useQuery({
    queryKey: ['reports', 'monthly', groupId],
    queryFn: async () => {
      const { data } = await reportsApi.monthly(groupId, new Date().getFullYear());
      return data.data;
    },
  });

  const { data: budgetsData } = useQuery({
    queryKey: ['budgets', groupId],
    queryFn: async () => {
      const { data } = await budgetsApi.list(groupId, { limit: 50 });
      return data;
    },
  });

  const budgets = budgetsData?.data || [];

  const { data: yearlyReport, isLoading: yearlyLoading } = useQuery({
    queryKey: ['reports', 'yearly', groupId],
    queryFn: async () => {
      const { data } = await reportsApi.yearly(groupId);
      return data.data;
    },
  });

  const { data: spendingTrends, isLoading: trendsLoading } = useQuery({
    queryKey: ['reports', 'trends', groupId],
    queryFn: async () => {
      const { data } = await reportsApi.trends(groupId);
      return data.data;
    },
  });

  const { data: budgetReport, isLoading: budgetReportLoading } = useQuery({
    queryKey: ['reports', 'budgetReport', groupId],
    queryFn: async () => {
      const { data } = await reportsApi.budgetReport(groupId);
      return data.data;
    },
  });

  const { data: savingsAnalysis, isLoading: savingsLoading } = useQuery({
    queryKey: ['reports', 'savings', groupId],
    queryFn: async () => {
      const { data } = await reportsApi.savings(groupId);
      return data.data;
    },
  });

  if (summaryLoading) return <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />;

  const totalBudgetsLimit = budgets?.reduce((sum, b) => sum + parseFloat(b.amount_limit), 0) || 0;

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const getProgressColor = (pct) => {
    if (pct >= 100) return 'error';
    if (pct >= 80) return 'warning';
    return 'success';
  };

  const getStatusChipColor = (status) => {
    switch (status) {
      case 'exceeded': return 'error';
      case 'warning': return 'warning';
      default: return 'success';
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" fontWeight={600}>Analytics & Reports</Typography>
      </Box>

      {/* Tabs Menu */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          textColor="primary"
          indicatorColor="primary"
        >
          <Tab icon={<PieIcon fontSize="small" />} iconPosition="start" label="Overview" />
          <Tab icon={<BarIcon fontSize="small" />} iconPosition="start" label="Yearly Spends" />
          <Tab icon={<TrendsIcon fontSize="small" />} iconPosition="start" label="Spending Trends" />
          <Tab icon={<BudgetIcon fontSize="small" />} iconPosition="start" label="Budget Progress" />
          <Tab icon={<SavingsIcon fontSize="small" />} iconPosition="start" label="Savings Analysis" />
        </Tabs>
      </Box>

      {/* Summary Cards Row (Shared) */}
      <Grid container spacing={3} mb={3}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="body2" gutterBottom>Total Expenses</Typography>
              <Typography variant="h5" fontWeight={700} color="primary.main">
                {formatCurrency(summary?.expenses?.totalAmount || 0, group?.currency)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {summary?.expenses?.count || 0} active expenses
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="body2" gutterBottom>Total Settled</Typography>
              <Typography variant="h5" fontWeight={700} color="success.main">
                {formatCurrency(summary?.settlements?.settledAmount || 0, group?.currency)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {summary?.settlements?.count || 0} settlements completed
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="body2" gutterBottom>Budgets Allocation</Typography>
              <Typography variant="h5" fontWeight={700} color="secondary.main">
                {formatCurrency(totalBudgetsLimit, group?.currency)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {budgets?.length || 0} active budgets configured
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tab Panels */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          {/* Category breakdown (Donut) */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>Category Breakdown</Typography>
                <Box mt={2}>
                  <DonutChart data={categoryReport || []} currency={group?.currency} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Member Spend Comparison Bar */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>Top Spenders (Paid vs Spent)</Typography>
                <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                  Paid is how much they funded. Spent is their actual share (what they consumed).
                </Typography>
                <SpendersBarChart data={memberReport || []} currency={group?.currency} />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 1 && (
        <Box>
          {yearlyLoading ? (
            <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
          ) : (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, lg: 8 }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>Yearly Spending Chart</Typography>
                    <YearlyBarChart data={yearlyReport || []} currency={group?.currency} />
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, lg: 4 }}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600} mb={2}>Yearly Summary</Typography>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell><Typography variant="body2" fontWeight={600}>Year</Typography></TableCell>
                            <TableCell align="right"><Typography variant="body2" fontWeight={600}>Total Amount</Typography></TableCell>
                            <TableCell align="right"><Typography variant="body2" fontWeight={600}>Expenses</Typography></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {yearlyReport?.map((row) => (
                            <TableRow key={row.year} hover>
                              <TableCell>{row.year}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>
                                {formatCurrency(row.total_amount, group?.currency)}
                              </TableCell>
                              <TableCell align="right">{row.expense_count}</TableCell>
                            </TableRow>
                          ))}
                          {(!yearlyReport || yearlyReport.length === 0) && (
                            <TableRow>
                              <TableCell colSpan={3} align="center">No data found</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </Box>
      )}

      {activeTab === 2 && (
        <Box>
          {trendsLoading ? (
            <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
          ) : (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }}>
                <Card>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} mb={2}>
                      <Typography variant="subtitle1" fontWeight={600}>Spending Trend Analysis</Typography>
                      <Chip
                        icon={<TrendsIcon fontSize="small" />}
                        label={`Average Spend: ${formatCurrency(spendingTrends?.averageSpend || 0, group?.currency)}/month`}
                        color="primary"
                        variant="outlined"
                      />
                    </Box>
                    <TrendAreaChart data={monthlyReport || []} currency={group?.currency} />
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600} mb={2}>Month-over-Month (MoM) Changes</Typography>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell><Typography variant="body2" fontWeight={600}>Month</Typography></TableCell>
                            <TableCell align="right"><Typography variant="body2" fontWeight={600}>Total Spent</Typography></TableCell>
                            <TableCell align="right"><Typography variant="body2" fontWeight={600}>Expenses Count</Typography></TableCell>
                            <TableCell align="right"><Typography variant="body2" fontWeight={600}>MoM Change</Typography></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {spendingTrends?.trends?.map((t, idx) => {
                            const change = t.changePercentage;
                            let color = 'text.secondary';
                            let icon = null;
                            if (idx > 0) {
                              if (change < 0) {
                                color = 'success.main';
                                icon = <TrendingDownIcon fontSize="small" style={{ verticalAlign: 'middle', marginRight: 4 }} />;
                              } else if (change > 0) {
                                color = 'error.main';
                                icon = <TrendingUpIcon fontSize="small" style={{ verticalAlign: 'middle', marginRight: 4 }} />;
                              }
                            }
                            return (
                              <TableRow key={t.month} hover>
                                <TableCell>{dayjs(t.month).format('MMMM YYYY')}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600 }}>
                                  {formatCurrency(t.totalAmount, group?.currency)}
                                </TableCell>
                                <TableCell align="right">{t.expenseCount}</TableCell>
                                <TableCell align="right" sx={{ color, fontWeight: idx > 0 ? 600 : 400 }}>
                                  {idx === 0 ? (
                                    <Typography variant="body2" color="text.secondary">—</Typography>
                                  ) : (
                                    <Box display="inline-flex" alignItems="center">
                                      {icon}
                                      {change > 0 ? `+${change}%` : `${change}%`}
                                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1, fontWeight: 400 }}>
                                        {change < 0 ? '(savings)' : '(increase)'}
                                      </Typography>
                                    </Box>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {(!spendingTrends?.trends || spendingTrends.trends.length === 0) && (
                            <TableRow>
                              <TableCell colSpan={4} align="center">No trends data available</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </Box>
      )}

      {activeTab === 3 && (
        <Box>
          {budgetReportLoading ? (
            <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
          ) : (
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} mb={2}>All Budgets Progress</Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell><Typography variant="body2" fontWeight={600}>Budget Name & Scope</Typography></TableCell>
                        <TableCell><Typography variant="body2" fontWeight={600}>Type</Typography></TableCell>
                        <TableCell align="right"><Typography variant="body2" fontWeight={600}>Limit</Typography></TableCell>
                        <TableCell align="right"><Typography variant="body2" fontWeight={600}>Spent</Typography></TableCell>
                        <TableCell align="right"><Typography variant="body2" fontWeight={600}>Remaining</Typography></TableCell>
                        <TableCell width="25%"><Typography variant="body2" fontWeight={600}>Usage</Typography></TableCell>
                        <TableCell align="center"><Typography variant="body2" fontWeight={600}>Status</Typography></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {budgetReport?.map((b) => (
                        <TableRow key={b.id} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>{b.name}</Typography>
                            {b.budgetType === 'category' && b.categoryName && (
                              <Typography variant="caption" color="text.secondary">Category: {b.categoryName}</Typography>
                            )}
                            {b.budgetType === 'member' && b.memberName && (
                              <Typography variant="caption" color="text.secondary">Member: {b.memberName}</Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={b.budgetType.toUpperCase()}
                              size="small"
                              variant="outlined"
                              color={b.budgetType === 'group' ? 'primary' : b.budgetType === 'category' ? 'secondary' : 'default'}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 500 }}>
                            {formatCurrency(b.limit, group?.currency)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 500 }}>
                            {formatCurrency(b.spent, group?.currency)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, color: b.remaining < 0 ? 'error.main' : 'success.main' }}>
                            {b.remaining < 0
                              ? `-${formatCurrency(Math.abs(b.remaining), group?.currency)}`
                              : formatCurrency(b.remaining, group?.currency)}
                          </TableCell>
                          <TableCell>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Box flex={1}>
                                <LinearProgress
                                  variant="determinate"
                                  value={Math.min(b.percentage, 100)}
                                  color={getProgressColor(b.percentage)}
                                  sx={{ height: 8, borderRadius: 4 }}
                                />
                              </Box>
                              <Typography variant="caption" fontWeight={600}>{b.percentage}%</Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={b.status.toUpperCase()}
                              size="small"
                              color={getStatusChipColor(b.status)}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!budgetReport || budgetReport.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={7} align="center">No active budgets are currently configured</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}
        </Box>
      )}

      {activeTab === 4 && (
        <Box>
          {savingsLoading ? (
            <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
          ) : (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 4 }}>
                <Card sx={{ bgcolor: 'primary.dark', color: 'primary.contrastText', height: '100%' }}>
                  <CardContent>
                    <Typography variant="body2" gutterBottom opacity={0.8}>Total Budgets Limit</Typography>
                    <Typography variant="h4" fontWeight={800} mb={1}>
                      {formatCurrency(savingsAnalysis?.totalBudgetLimit || 0, group?.currency)}
                    </Typography>
                    <Typography variant="caption" opacity={0.7}>Across all active budget policies</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Card sx={{ bgcolor: 'action.disabledBackground', height: '100%' }}>
                  <CardContent>
                    <Typography color="text.secondary" variant="body2" gutterBottom>Total Budgeted Spending</Typography>
                    <Typography variant="h4" fontWeight={800} mb={1}>
                      {formatCurrency(savingsAnalysis?.totalSpent || 0, group?.currency)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">Spent under budgeted categories</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Card sx={{
                  bgcolor: (savingsAnalysis?.totalSavings || 0) >= 0 ? 'success.dark' : 'error.dark',
                  color: '#ffffff',
                  height: '100%'
                }}>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="body2" opacity={0.8}>Total Savings</Typography>
                      <SavingsIcon />
                    </Box>
                    <Typography variant="h4" fontWeight={800} mb={0.5}>
                      {formatCurrency(savingsAnalysis?.totalSavings || 0, group?.currency)}
                    </Typography>
                    <Typography variant="caption" opacity={0.8} fontWeight={600}>
                      {savingsAnalysis?.savingsPercentage}% of budget saved
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600} mb={2}>Category Savings Breakdown</Typography>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell><Typography variant="body2" fontWeight={600}>Category / Scope</Typography></TableCell>
                            <TableCell align="right"><Typography variant="body2" fontWeight={600}>Limit</Typography></TableCell>
                            <TableCell align="right"><Typography variant="body2" fontWeight={600}>Spent</Typography></TableCell>
                            <TableCell align="right"><Typography variant="body2" fontWeight={600}>Amount Saved</Typography></TableCell>
                            <TableCell align="right"><Typography variant="body2" fontWeight={600}>Status</Typography></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {savingsAnalysis?.categorySavings && Object.keys(savingsAnalysis.categorySavings).map((cat) => {
                            const val = savingsAnalysis.categorySavings[cat];
                            const savings = val.savings;
                            const spentPct = val.limit > 0 ? Math.round((val.spent / val.limit) * 100) : 0;
                            return (
                              <TableRow key={cat} hover>
                                <TableCell sx={{ fontWeight: 600 }}>{cat}</TableCell>
                                <TableCell align="right">{formatCurrency(val.limit, group?.currency)}</TableCell>
                                <TableCell align="right">{formatCurrency(val.spent, group?.currency)}</TableCell>
                                <TableCell align="right" sx={{
                                  fontWeight: 600,
                                  color: savings >= 0 ? 'success.main' : 'error.main'
                                }}>
                                  {savings >= 0
                                    ? `+${formatCurrency(savings, group?.currency)}`
                                    : `-${formatCurrency(Math.abs(savings), group?.currency)}`}
                                </TableCell>
                                <TableCell align="right">
                                  <Chip
                                    label={savings >= 0 ? `${100 - spentPct}% saved` : `${spentPct - 100}% overspent`}
                                    size="small"
                                    color={savings >= 0 ? 'success' : 'error'}
                                    variant="light"
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {(!savingsAnalysis?.categorySavings || Object.keys(savingsAnalysis.categorySavings).length === 0) && (
                            <TableRow>
                              <TableCell colSpan={5} align="center">No active budget allocations for savings breakdown</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </Box>
      )}
    </Box>
  );
}
