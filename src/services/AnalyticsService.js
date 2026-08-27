/**
 * ZERO FRICTION — Analytics Service
 * Centralized financial analytics calculations.
 * All screens pull from here instead of computing independently.
 */

import {
  getTotalSpending,
  getCategoryBreakdown,
  getDailyTotals,
  getLargestExpense,
  getBudgets,
} from '../database/db';
import {
  startOfToday,
  startOfWeek,
  startOfMonth,
  startOfLastMonth,
  endOfLastMonth,
  startOfYear,
  daysAgo,
  daysBetween,
  daysRemainingInMonth,
  dateToKey,
} from '../utils/dates';
import { sumAmounts, safePercent, formatINR, toPaise, toRupees } from '../utils/money';

/**
 * Get today's total spending.
 */
export async function getTodaySpend() {
  const start = startOfToday().toISOString();
  return getTotalSpending(start);
}

/**
 * Get this week's total spending (Mon–today).
 */
export async function getWeekSpend() {
  const start = startOfWeek().toISOString();
  return getTotalSpending(start);
}

/**
 * Get this month's total spending.
 */
export async function getMonthSpend() {
  const start = startOfMonth().toISOString();
  return getTotalSpending(start);
}

/**
 * Get last month's total spending.
 */
export async function getLastMonthSpend() {
  const start = startOfLastMonth().toISOString();
  const end = endOfLastMonth().toISOString();
  return getTotalSpending(start, end);
}

/**
 * Get this year's total spending.
 */
export async function getYearSpend() {
  const start = startOfYear().toISOString();
  return getTotalSpending(start);
}

/**
 * Get daily average for the current month.
 */
export async function getMonthlyDailyAverage() {
  const start = startOfMonth();
  const now = new Date();
  const days = daysBetween(start, now);
  const { total } = await getMonthSpend();
  return days > 0 ? total / days : 0;
}

/**
 * Get category breakdown for the current month.
 */
export async function getMonthCategoryBreakdown() {
  const start = startOfMonth().toISOString();
  return getCategoryBreakdown(start);
}

/**
 * Get the top category this month.
 */
export async function getTopCategory() {
  const breakdown = await getMonthCategoryBreakdown();
  if (!breakdown || breakdown.length === 0) return null;
  return breakdown[0]; // Already sorted DESC by total
}

/**
 * Get the largest expense this month.
 */
export async function getMonthLargestExpense() {
  const start = startOfMonth().toISOString();
  return getLargestExpense(start);
}

/**
 * Get projected monthly spending based on current pace.
 */
export async function getProjectedMonthlySpend() {
  const start = startOfMonth();
  const now = new Date();
  const daysElapsed = daysBetween(start, now);
  const { total } = await getMonthSpend();

  if (daysElapsed <= 0) return 0;

  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return (total / daysElapsed) * lastDay;
}

/**
 * Get budget status.
 * Returns { hasOverallBudget, overallBudget, spent, remaining, percentUsed, dailyAllowance }
 */
export async function getBudgetStatus() {
  try {
    const budgets = await getBudgets();
    const overall = budgets.find((b) => b.is_overall === 1);

    if (!overall || !overall.monthly_limit || overall.monthly_limit <= 0) {
      return { hasOverallBudget: false };
    }

    const { total: spent } = await getMonthSpend();
    const remaining = Math.max(0, overall.monthly_limit - spent);
    const percentUsed = safePercent(spent, overall.monthly_limit);
    const daysLeft = daysRemainingInMonth();
    const dailyAllowance = daysLeft > 0 ? remaining / daysLeft : 0;

    return {
      hasOverallBudget: true,
      overallBudget: overall.monthly_limit,
      spent,
      remaining,
      percentUsed: Math.min(percentUsed, 100),
      isOverBudget: spent > overall.monthly_limit,
      dailyAllowance,
      daysLeft,
    };
  } catch {
    return { hasOverallBudget: false };
  }
}

/**
 * Generate data-driven insights.
 * Returns an array of insight objects: { type, text, severity }
 */
export async function generateInsights() {
  const insights = [];

  try {
    // Monthly data
    const monthData = await getMonthSpend();
    const lastMonthData = await getLastMonthSpend();
    const dailyAvg = await getMonthlyDailyAverage();
    const todayData = await getTodaySpend();
    const topCat = await getTopCategory();
    const largest = await getMonthLargestExpense();
    const budget = await getBudgetStatus();

    // Insight: Month-over-month comparison
    if (lastMonthData.total > 0 && monthData.total > 0) {
      const changePercent = safePercent(monthData.total - lastMonthData.total, lastMonthData.total);
      if (Math.abs(changePercent) >= 10) {
        const direction = changePercent > 0 ? 'more' : 'less';
        const absPercent = Math.abs(changePercent).toFixed(0);
        insights.push({
          type: 'trend',
          text: `You've spent ${absPercent}% ${direction} this month compared to last month.`,
          severity: changePercent > 20 ? 'warning' : changePercent < -10 ? 'success' : 'info',
        });
      }
    }

    // Insight: Daily average
    if (dailyAvg > 0) {
      insights.push({
        type: 'average',
        text: `Your average daily spending is ${formatINR(dailyAvg, { showPaise: false })}.`,
        severity: 'info',
      });
    }

    // Insight: Top category share
    if (topCat && monthData.total > 0) {
      const share = safePercent(topCat.total, monthData.total);
      if (share >= 25) {
        insights.push({
          type: 'category',
          text: `${topCat.category} represents ${share.toFixed(0)}% of this month's spending.`,
          severity: share >= 50 ? 'warning' : 'info',
        });
      }
    }

    // Insight: Largest expense
    if (largest && largest.expense >= 500) {
      insights.push({
        type: 'largest',
        text: `Your largest expense was ${formatINR(largest.expense, { showPaise: false })} on ${largest.merchant || largest.category}.`,
        severity: 'info',
      });
    }

    // Insight: Today's spending vs average
    if (todayData.total > 0 && dailyAvg > 0) {
      const ratio = todayData.total / dailyAvg;
      if (ratio >= 2) {
        insights.push({
          type: 'today',
          text: `Today's spending is ${ratio.toFixed(1)}× your daily average.`,
          severity: 'warning',
        });
      }
    }

    // Insight: Budget
    if (budget.hasOverallBudget) {
      if (budget.isOverBudget) {
        insights.push({
          type: 'budget',
          text: `You've exceeded your monthly budget by ${formatINR(budget.spent - budget.overallBudget, { showPaise: false })}.`,
          severity: 'error',
        });
      } else if (budget.percentUsed >= 80) {
        insights.push({
          type: 'budget',
          text: `You've used ${budget.percentUsed.toFixed(0)}% of your monthly budget. ${formatINR(budget.remaining, { showPaise: false })} remaining.`,
          severity: 'warning',
        });
      }
    }
  } catch (error) {
    console.error('[Analytics] Error generating insights:', error);
  }

  return insights;
}

/**
 * Get the full analytics dashboard data in one call.
 * Every value is defensively defaulted so screens never crash.
 */
export async function getDashboardData() {
  try {
    const [today, week, month, lastMonth, dailyAvg, breakdown, topCat, largest, budget, insightsData] =
      await Promise.all([
        getTodaySpend().catch(() => ({ total: 0, count: 0 })),
        getWeekSpend().catch(() => ({ total: 0, count: 0 })),
        getMonthSpend().catch(() => ({ total: 0, count: 0 })),
        getLastMonthSpend().catch(() => ({ total: 0, count: 0 })),
        getMonthlyDailyAverage().catch(() => 0),
        getMonthCategoryBreakdown().catch(() => []),
        getTopCategory().catch(() => null),
        getMonthLargestExpense().catch(() => null),
        getBudgetStatus().catch(() => ({ hasOverallBudget: false })),
        generateInsights().catch(() => []),
      ]);

    return {
      today,
      week,
      month,
      lastMonth,
      dailyAvg,
      categoryBreakdown: breakdown || [],
      topCategory: topCat,
      largestExpense: largest,
      budget,
      insights: insightsData || [],
      projected: await getProjectedMonthlySpend().catch(() => 0),
    };
  } catch (error) {
    console.error('[Analytics] getDashboardData error:', error);
    return {
      today: { total: 0, count: 0 },
      week: { total: 0, count: 0 },
      month: { total: 0, count: 0 },
      lastMonth: { total: 0, count: 0 },
      dailyAvg: 0,
      categoryBreakdown: [],
      topCategory: null,
      largestExpense: null,
      budget: { hasOverallBudget: false },
      insights: [],
      projected: 0,
    };
  }
}
