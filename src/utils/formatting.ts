export const formatCurrency = (amount: number, currency: 'USD' | 'TRY'): string => {
    // For small amounts (like funds), show more decimal places
    const isSmallAmount = Math.abs(amount) < 1 && Math.abs(amount) > 0;
    const decimals = isSmallAmount ? 6 : 2;

    const formatter = new Intl.NumberFormat('tr-TR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });

    const formattedAmount = formatter.format(amount);
    const symbol = currency === 'USD' ? '$' : '₺';

    return `${formattedAmount} ${symbol}`;
};
