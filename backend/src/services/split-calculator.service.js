import { badRequest } from '../utils/app-error.js';

export function calculateSplit({ splitType, totalAmount, participants }) {
  const amount = parseFloat(totalAmount);
  if (isNaN(amount) || amount <= 0) throw badRequest('Amount must be positive');

  const included = participants.filter((p) => p.isIncluded !== false);
  if (included.length === 0) throw badRequest('At least one participant required');

  switch (splitType) {
    case 'equal':
      return calculateEqual(amount, included);
    case 'unequal':
      return calculateUnequal(amount, included);
    case 'percentage':
      return calculatePercentage(amount, included);
    case 'shares':
      return calculateShares(amount, included);
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

export default { calculateSplit };
