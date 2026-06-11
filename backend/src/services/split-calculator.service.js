import { badRequest } from '../utils/app-error.js';

export function calculateSplit({ splitType, totalAmount, participants, items, memberDays, memberConsumption, hybridConfig }) {
  const amount = parseFloat(totalAmount);
  if (isNaN(amount) || amount <= 0) throw badRequest('Amount must be positive');

  const included = participants ? participants.filter((p) => p.isIncluded !== false) : [];

  switch (splitType) {
    case 'equal':
      if (included.length === 0) throw badRequest('At least one participant required');
      return calculateEqual(amount, included);
    case 'unequal':
      if (included.length === 0) throw badRequest('At least one participant required');
      return calculateUnequal(amount, included);
    case 'percentage':
      if (included.length === 0) throw badRequest('At least one participant required');
      return calculatePercentage(amount, included);
    case 'shares':
      if (included.length === 0) throw badRequest('At least one participant required');
      return calculateShares(amount, included);
    case 'item_wise':
      if (!items || items.length === 0) throw badRequest('Items are required for item-wise split');
      return calculateItemWise(amount, items);
    case 'days_wise':
      if (!memberDays || memberDays.length === 0) throw badRequest('Member days are required for days-wise split');
      return calculateDaysWise(amount, memberDays);
    case 'consumption_wise':
      if (!memberConsumption || memberConsumption.length === 0) throw badRequest('Member consumption data is required');
      return calculateConsumptionWise(amount, memberConsumption);
    case 'hybrid':
      if (!hybridConfig || hybridConfig.length === 0) throw badRequest('Hybrid config is required');
      return calculateHybrid(amount, hybridConfig);
    default:
      throw badRequest(`Invalid split type: ${splitType}`);
  }
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function calculateEqual(total, participants) {
  const base = round2(total / participants.length);
  const shares = participants.map((p, i) => ({
    memberId: p.memberId,
    shareAmount: i === participants.length - 1
      ? round2(total - base * (participants.length - 1))
      : base,
    sharePercentage: round2(100 / participants.length),
    isIncluded: true,
  }));
  return shares;
}

function calculateUnequal(total, participants) {
  const sum = participants.reduce((s, p) => s + parseFloat(p.shareAmount || 0), 0);
  if (Math.abs(sum - total) > 0.01) {
    throw badRequest(`Share amounts (${sum}) must equal total (${total})`);
  }
  return participants.map((p) => ({
    memberId: p.memberId,
    shareAmount: round2(parseFloat(p.shareAmount)),
    sharePercentage: round2((parseFloat(p.shareAmount) / total) * 100),
    isIncluded: true,
  }));
}

function calculatePercentage(total, participants) {
  const sum = participants.reduce((s, p) => s + parseFloat(p.sharePercentage || 0), 0);
  if (Math.abs(sum - 100) > 0.01) {
    throw badRequest(`Percentages must sum to 100, got ${sum}`);
  }
  let allocated = 0;
  return participants.map((p, i) => {
    const shareAmount = i === participants.length - 1
      ? round2(total - allocated)
      : round2((parseFloat(p.sharePercentage) / 100) * total);
    allocated += shareAmount;
    return {
      memberId: p.memberId,
      shareAmount,
      sharePercentage: parseFloat(p.sharePercentage),
      isIncluded: true,
    };
  });
}

function calculateShares(total, participants) {
  const totalUnits = participants.reduce((s, p) => s + parseFloat(p.shareUnits || 1), 0);
  if (totalUnits <= 0) throw badRequest('Total shares must be positive');

  let allocated = 0;
  return participants.map((p, i) => {
    const units = parseFloat(p.shareUnits || 1);
    const shareAmount = i === participants.length - 1
      ? round2(total - allocated)
      : round2((units / totalUnits) * total);
    allocated += shareAmount;
    return {
      memberId: p.memberId,
      shareAmount,
      shareUnits: units,
      sharePercentage: round2((units / totalUnits) * 100),
      isIncluded: true,
    };
  });
}

/**
 * Item-wise Split:
 * Each item has a list of members who share it.
 * Each member's total share = sum of their share across all items.
 * items = [{ name, amount, participants: [{ memberId }] }]
 */
function calculateItemWise(total, items) {
  const itemsTotal = items.reduce((s, item) => s + parseFloat(item.amount), 0);
  if (Math.abs(itemsTotal - total) > 0.01) {
    throw badRequest(`Items total (${itemsTotal}) must equal expense total (${total})`);
  }

  const memberShares = new Map();

  for (const item of items) {
    const itemAmount = parseFloat(item.amount);
    const itemParticipants = item.participants || [];
    if (itemParticipants.length === 0) throw badRequest(`Item "${item.name}" must have at least one participant`);

    const perPerson = round2(itemAmount / itemParticipants.length);

    itemParticipants.forEach((p, i) => {
      const share = i === itemParticipants.length - 1
        ? round2(itemAmount - perPerson * (itemParticipants.length - 1))
        : perPerson;

      const current = memberShares.get(p.memberId) || 0;
      memberShares.set(p.memberId, round2(current + share));
    });
  }

  // Adjust for rounding to match total exactly
  const shares = [];
  let allocatedTotal = 0;
  const entries = Array.from(memberShares.entries());

  entries.forEach(([memberId, shareAmount], i) => {
    const finalAmount = i === entries.length - 1
      ? round2(total - allocatedTotal)
      : shareAmount;
    allocatedTotal += finalAmount;
    shares.push({
      memberId,
      shareAmount: finalAmount,
      sharePercentage: round2((finalAmount / total) * 100),
      isIncluded: true,
    });
  });

  return shares;
}

/**
 * Days-wise Split:
 * Split based on number of days each member participated.
 * memberDays = [{ memberId, days }]
 */
function calculateDaysWise(total, memberDays) {
  const totalDays = memberDays.reduce((s, m) => s + parseFloat(m.days || 0), 0);
  if (totalDays <= 0) throw badRequest('Total days must be positive');

  let allocated = 0;
  return memberDays.map((m, i) => {
    const days = parseFloat(m.days || 0);
    const shareAmount = i === memberDays.length - 1
      ? round2(total - allocated)
      : round2((days / totalDays) * total);
    allocated += shareAmount;
    return {
      memberId: m.memberId,
      shareAmount,
      shareUnits: days,
      sharePercentage: round2((days / totalDays) * 100),
      isIncluded: true,
    };
  });
}

/**
 * Consumption-wise Split:
 * Split based on consumption units (e.g., meals, drinks, items consumed).
 * memberConsumption = [{ memberId, units }]
 */
function calculateConsumptionWise(total, memberConsumption) {
  const totalUnits = memberConsumption.reduce((s, m) => s + parseFloat(m.units || 0), 0);
  if (totalUnits <= 0) throw badRequest('Total consumption units must be positive');

  let allocated = 0;
  return memberConsumption.map((m, i) => {
    const units = parseFloat(m.units || 0);
    const shareAmount = i === memberConsumption.length - 1
      ? round2(total - allocated)
      : round2((units / totalUnits) * total);
    allocated += shareAmount;
    return {
      memberId: m.memberId,
      shareAmount,
      shareUnits: units,
      sharePercentage: round2((units / totalUnits) * 100),
      isIncluded: true,
    };
  });
}

/**
 * Hybrid Split:
 * Combine fixed, percentage, and equal methods in one expense.
 * hybridConfig = [{ memberId, method: 'fixed'|'percentage'|'equal', value }]
 * 
 * Process:
 * 1. Deduct all fixed amounts from total
 * 2. Apply percentages to the remaining amount
 * 3. Split whatever is left equally among 'equal' members
 */
function calculateHybrid(total, hybridConfig) {
  const fixedMembers = hybridConfig.filter(c => c.method === 'fixed');
  const percentageMembers = hybridConfig.filter(c => c.method === 'percentage');
  const equalMembers = hybridConfig.filter(c => c.method === 'equal');

  // Step 1: Calculate fixed amounts
  const fixedTotal = fixedMembers.reduce((s, m) => s + parseFloat(m.value || 0), 0);
  if (fixedTotal > total) throw badRequest('Fixed amounts exceed total');

  let remaining = total - fixedTotal;

  // Step 2: Calculate percentage amounts (from remaining after fixed)
  const percentageTotal = percentageMembers.reduce((s, m) => s + parseFloat(m.value || 0), 0);
  if (percentageTotal > 100) throw badRequest('Percentages exceed 100%');

  const percentageAmounts = {};
  let percentageSpent = 0;
  percentageMembers.forEach((m) => {
    const amt = round2((parseFloat(m.value) / 100) * remaining);
    percentageAmounts[m.memberId] = amt;
    percentageSpent += amt;
  });

  // Step 3: Split remainder equally
  const equalRemaining = round2(remaining - percentageSpent);
  if (equalRemaining < 0) throw badRequest('Not enough remaining for equal split after fixed and percentage allocations');

  const equalShare = equalMembers.length > 0 ? round2(equalRemaining / equalMembers.length) : 0;

  // Build final shares
  const shares = [];
  let allocated = 0;

  for (const m of fixedMembers) {
    const amt = round2(parseFloat(m.value));
    allocated += amt;
    shares.push({
      memberId: m.memberId,
      shareAmount: amt,
      sharePercentage: round2((amt / total) * 100),
      isIncluded: true,
    });
  }

  for (const m of percentageMembers) {
    const amt = percentageAmounts[m.memberId];
    allocated += amt;
    shares.push({
      memberId: m.memberId,
      shareAmount: amt,
      sharePercentage: round2((amt / total) * 100),
      isIncluded: true,
    });
  }

  equalMembers.forEach((m, i) => {
    const amt = i === equalMembers.length - 1
      ? round2(total - allocated)
      : equalShare;
    allocated += amt;
    shares.push({
      memberId: m.memberId,
      shareAmount: amt,
      sharePercentage: round2((amt / total) * 100),
      isIncluded: true,
    });
  });

  return shares;
}

export default { calculateSplit };
