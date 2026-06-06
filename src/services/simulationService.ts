type HistoryPoint = {
  date: string;
  valueTry: number;
  valueUsd: number;
};

export type ContributionProjection = {
  projectedValue: number;
  contributedCapital: number;
  projectedGain: number;
  monthlyRate: number;
  annualizedRate: number;
  basisDays: number;
  isTrendBased: boolean;
};

const MAX_LOOKBACK_POINTS = 90;
const MAX_ABSOLUTE_MONTHLY_RATE = 0.2;

const toDate = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

export const projectRecurringContribution = (
  history: HistoryPoint[],
  currentValue: number,
  monthlyContribution: number,
  months: number
): ContributionProjection => {
  const sanitizedCurrentValue = Math.max(0, currentValue || 0);
  const sanitizedContribution = Math.max(0, monthlyContribution || 0);
  const sanitizedMonths = Math.max(1, Math.round(months || 1));

  const recentHistory = history
    .filter(point => point.valueTry > 0 && !!toDate(point.date))
    .slice(-MAX_LOOKBACK_POINTS);

  let monthlyRate = 0;
  let annualizedRate = 0;
  let basisDays = 0;
  let isTrendBased = false;

  if (recentHistory.length >= 7) {
    const firstPoint = recentHistory[0];
    const lastPoint = recentHistory[recentHistory.length - 1];
    const firstDate = toDate(firstPoint.date);
    const lastDate = toDate(lastPoint.date);

    if (firstDate && lastDate && firstPoint.valueTry > 0 && lastPoint.valueTry > 0) {
      const diffMs = lastDate.getTime() - firstDate.getTime();
      basisDays = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));

      if (basisDays >= 7) {
        const totalReturnFactor = lastPoint.valueTry / firstPoint.valueTry;
        if (totalReturnFactor > 0) {
          const dailyRate = Math.pow(totalReturnFactor, 1 / basisDays) - 1;
          monthlyRate = clamp(
            Math.pow(1 + dailyRate, 30) - 1,
            -MAX_ABSOLUTE_MONTHLY_RATE,
            MAX_ABSOLUTE_MONTHLY_RATE
          );
          annualizedRate = Math.pow(1 + monthlyRate, 12) - 1;
          isTrendBased = true;
        }
      }
    }
  }

  let projectedValue = sanitizedCurrentValue;
  for (let month = 0; month < sanitizedMonths; month += 1) {
    projectedValue = projectedValue * (1 + monthlyRate) + sanitizedContribution;
  }

  const contributedCapital = sanitizedContribution * sanitizedMonths;
  const projectedGain = projectedValue - sanitizedCurrentValue - contributedCapital;

  return {
    projectedValue,
    contributedCapital,
    projectedGain,
    monthlyRate,
    annualizedRate,
    basisDays,
    isTrendBased,
  };
};
