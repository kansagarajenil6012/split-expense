export const formatCurrency = (amount, currency = 'INR') => {
  const num = parseFloat(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(num);
};

export const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const formatRelativeTime = (date) => {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
};

export const getBalanceLabel = (balance) => {
  const b = parseFloat(balance);
  if (Math.abs(b) < 0.01) return { text: 'Settled up', color: 'success.main', type: 'neutral' };
  if (b > 0) return { text: 'You owe', color: 'error.main', type: 'owe' };
  return { text: 'You are owed', color: 'success.main', type: 'owed' };
};

export const GROUP_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'friends', label: 'Friends' },
  { value: 'office', label: 'Office Team' },
  { value: 'food_club', label: 'Food Club' },
  { value: 'sports', label: 'Sports Club' },
  { value: 'travel', label: 'Travel Group' },
];

export const SPLIT_TYPES = [
  { value: 'equal', label: 'Split Equally' },
  { value: 'unequal', label: 'Split by Amount' },
  { value: 'percentage', label: 'Split by Percentage' },
  { value: 'shares', label: 'Split by Shares' },
  { value: 'itemized', label: 'Itemized Receipt' },
];
