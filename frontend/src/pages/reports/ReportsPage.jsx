import { useState } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import {
  Box, Grid2 as Grid, Card, CardContent, Typography, Skeleton,
  Table, TableBody, TableCell, TableHead, TableRow, Chip, LinearProgress, Stack
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { reportsApi, budgetsApi } from '../../services/api.js';
import { formatCurrency } from '../../utils/formatters.js';
import dayjs from 'dayjs';

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

// --- Main Reports Dashboard Page ---
export default function ReportsPage() {
  const { groupId } = useParams();
  const { group } = useOutletContext();

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

  const { data: budgets } = useQuery({
    queryKey: ['budgets', groupId],
    queryFn: async () => {
      const { data } = await budgetsApi.list(groupId, { limit: 50 });
      return data.data;
    },
  });

  if (summaryLoading) return <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />;

  const totalBudgetsLimit = budgets?.reduce((sum, b) => sum + parseFloat(b.amount_limit), 0) || 0;

  const getProgressColor = (pct) => {
    if (pct >= 100) return 'error';
    if (pct >= 80) return 'warning';
    return 'success';
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6" fontWeight={600}>Analytics & Reports</Typography>
      </Box>

      {/* Summary Row */}
      <Grid container spacing={3} mb={3}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="body2" gutterBottom>Total Expenses</Typography>
              <Typography variant="h4" fontWeight={700}>
                {formatCurrency(summary?.expenses?.totalAmount || 0, group?.currency)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {summary?.expenses?.count || 0} active expenses
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="body2" gutterBottom>Total Settled</Typography>
              <Typography variant="h4" fontWeight={700}>
                {formatCurrency(summary?.settlements?.settledAmount || 0, group?.currency)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {summary?.settlements?.count || 0} settlements
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="body2" gutterBottom>Budgets Allocation</Typography>
              <Typography variant="h4" fontWeight={700}>
                {formatCurrency(totalBudgetsLimit, group?.currency)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {budgets?.length || 0} active budgets set
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts Grid */}
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

        {/* Monthly Trend (Area Chart) */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>Monthly Expense Trends</Typography>
              <Box mt={2}>
                <TrendAreaChart data={monthlyReport || []} currency={group?.currency} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Budget Health Report */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>Budget Health Report</Typography>
              <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                Category-wise budget limits vs actual spending.
              </Typography>

              {budgets?.length === 0 ? (
                <Box py={4} textAlign="center">
                  <Typography color="text.secondary" variant="body2">No active budgets are currently configured.</Typography>
                </Box>
              ) : (
                <Stack spacing={2} sx={{ mt: 1 }}>
                  {budgets?.map((b) => {
                    const spent = parseFloat(b.spent_amount) || 0;
                    const limit = parseFloat(b.amount_limit);
                    const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
                    const remaining = limit - spent;

                    return (
                      <Box key={b.id}>
                        <Box display="flex" justifyContent="space-between" mb={0.5}>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body2" fontWeight={600} fontSize={13}>
                              {b.name}
                            </Typography>
                            {b.category_name && (
                              <Chip label={b.category_name} size="small" sx={{ height: 16, fontSize: 10 }} />
                            )}
                          </Box>
                          <Typography variant="caption" fontWeight={600}>
                            {formatCurrency(spent, group?.currency)} / {formatCurrency(limit, group?.currency)}
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(pct, 100)}
                          color={getProgressColor(pct)}
                          sx={{ height: 6, borderRadius: 3 }}
                        />
                        <Box display="flex" justifyContent="space-between" mt={0.25}>
                          <Typography variant="caption" color="text.secondary" fontSize={10}>
                            {pct}% spent
                          </Typography>
                          <Typography
                            variant="caption"
                            color={remaining < 0 ? 'error.main' : 'success.main'}
                            fontSize={10}
                            fontWeight={500}
                          >
                            {remaining >= 0
                              ? `${formatCurrency(remaining, group?.currency)} left`
                              : `${formatCurrency(Math.abs(remaining), group?.currency)} over`}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
