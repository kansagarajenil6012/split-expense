import ledgerRepository from '../repositories/ledger.repository.js';

export function buildExpenseLedgerEntries({ groupId, expenseId, currency, paidByMemberId, participants, occurredAt }) {
  const entries = [];

  const totalShares = participants.reduce((s, p) => s + parseFloat(p.shareAmount), 0);

  entries.push({
    groupId,
    memberId: paidByMemberId,
    entryType: 'expense_credit',
    amount: -totalShares,
    currency,
    referenceType: 'expense',
    referenceId: expenseId,
    description: 'Paid for expense',
    occurredAt,
  });

  for (const p of participants) {
    entries.push({
      groupId,
      memberId: p.memberId,
      entryType: 'expense_debit',
      amount: parseFloat(p.shareAmount),
      currency,
      referenceType: 'expense',
      referenceId: expenseId,
      description: 'Share of expense',
      occurredAt,
    });
  }

  return entries;
}

export function buildSettlementLedgerEntries({ groupId, settlementId, currency, fromMemberId, toMemberId, amount, occurredAt }) {
  return [
    {
      groupId,
      memberId: fromMemberId,
      entryType: 'settlement_credit',
      amount: -parseFloat(amount),
      currency,
      referenceType: 'settlement',
      referenceId: settlementId,
      description: 'Settlement payment',
      occurredAt,
    },
    {
      groupId,
      memberId: toMemberId,
      entryType: 'settlement_debit',
      amount: parseFloat(amount),
      currency,
      referenceType: 'settlement',
      referenceId: settlementId,
      description: 'Settlement received',
      occurredAt,
    },
  ];
}

export function optimizeSettlements(balances) {
  const creditors = [];
  const debtors = [];

  for (const b of balances) {
    const bal = parseFloat(b.balance);
    if (Math.abs(bal) < 0.01) continue;
    if (bal < 0) creditors.push({ memberId: b.member_id, userId: b.user_id, fullName: b.full_name, amount: -bal });
    else debtors.push({ memberId: b.member_id, userId: b.user_id, fullName: b.full_name, amount: bal });
  }

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const suggestions = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const transfer = Math.min(creditors[ci].amount, debtors[di].amount);
    if (transfer >= 0.01) {
      suggestions.push({
        fromMemberId: debtors[di].memberId,
        fromName: debtors[di].fullName,
        toMemberId: creditors[ci].memberId,
        toName: creditors[ci].fullName,
        amount: Math.round(transfer * 100) / 100,
      });
    }
    creditors[ci].amount -= transfer;
    debtors[di].amount -= transfer;
    if (creditors[ci].amount < 0.01) ci++;
    if (debtors[di].amount < 0.01) di++;
  }

  return suggestions;
}

export async function getGroupBalances(groupId) {
  return ledgerRepository.getBalancesByGroupId(groupId);
}

export default {
  buildExpenseLedgerEntries,
  buildSettlementLedgerEntries,
  optimizeSettlements,
  getGroupBalances,
};
