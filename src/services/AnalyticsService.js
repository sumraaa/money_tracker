/**
 * ZERO FRICTION — Analytics Service
 * Centralized financial analytics calculations.
 * All screens pull from here instead of computing independently.
 *
 * Includes: spending scores, safe-to-spend, merchant intelligence,
 * anomaly detection, weekly/monthly digests, and data-driven insights.
 */

import {
  getTotalSpending,
  getCategoryBreakdown,
  getDailyTotals,
  getLargestExpense,
  getBudgets,
  getAllExpenses,
  getMerchantBreakdown,
  getPaymentMethodBreakdown as getDbPaymentBreakdown,
} from '../database/db';
import {
  startOfToday,
  endOfToday,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfLastMonth,
  endOfLastMonth,
  startOfYear,
  endOfYear,
  daysAgo,
  daysBetween,
  daysRemainingInMonth,
  dateToKey,
} from '../utils/dates';
import { sumAmounts, safePercent, formatINR, toPaise, toRupees } from '../utils/money';

// ─── Core Spending Queries ──────────────────────────────────────

export async function getTodaySpend() {
  return getTotalSpending(startOfToday().toISOString(), endOfToday().toISOString());
}

export async function getWeekSpend() {
  return getTotalSpending(startOfWeek().toISOString(), endOfWeek().toISOString());
}

export async function getMonthSpend() {
  return getTotalSpending(startOfMonth().toISOString(), endOfMonth().toISOString());
}

export async function getLastMonthSpend() {
  return getTotalSpending(startOfLastMonth().toISOString(), endOfLastMonth().toISOString());
}

export async function getYearSpend() {
  return getTotalSpending(startOfYear().toISOString(), endOfYear().toISOString());
}

export async function getLastWeekSpend() {
  const thisWeekStart = startOfWeek();
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setMilliseconds(-1);
  return getTotalSpending(lastWeekStart.toISOString(), lastWeekEnd.toISOString());
}

// ─── Derived Metrics ────────────────────────────────────────────

export async function getMonthlyDailyAverage() {
  const start = startOfMonth();
  const now = new Date();
  const days = daysBetween(start, now);
  const { total } = await getMonthSpend();
  return days > 0 ? total / days : 0;
}

export async function getMonthCategoryBreakdown() {
  const start = startOfMonth().toISOString();
  return getCategoryBreakdown(start);
}

export async function getTopCategory() {
  const breakdown = await getMonthCategoryBreakdown();
  if (!breakdown || breakdown.length === 0) return null;
  return breakdown[0];
}

export async function getMonthLargestExpense() {
  const start = startOfMonth().toISOString();
  return getLargestExpense(start);
}

export async function getProjectedMonthlySpend() {
  const start = startOfMonth();
  const now = new Date();
  const daysElapsed = daysBetween(start, now);
  const { total } = await getMonthSpend();
  if (daysElapsed <= 0) return 0;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return (total / daysElapsed) * lastDay;
}

// ─── Budget Status ──────────────────────────────────────────────

export async function getBudgetStatus() {
  try {
    const budgets = await getBudgets();
    const overall = budgets.find((b) => b.is_overall === 1);

    if (!overall || !overall.monthly_limit || overall.monthly_limit <= 0) {
      return { hasOverallBudget: false };
    }

    const { total: spent } = await getMonthSpend();
    const remaining = overall.monthly_limit - spent;
    const percentUsed = safePercent(spent, overall.monthly_limit);
    const daysLeft = daysRemainingInMonth();
    const dailyAllowance = daysLeft > 0 ? Math.max(0, remaining) / daysLeft : 0;

    return {
      hasOverallBudget: true,
      overallBudget: overall.monthly_limit,
      spent,
      remaining: Math.max(0, remaining),
      overAmount: remaining < 0 ? Math.abs(remaining) : 0,
      percentUsed: Math.min(percentUsed, 150), // Cap at 150% for display
      isOverBudget: spent > overall.monthly_limit,
      dailyAllowance,
      daysLeft,
    };
  } catch {
    return { hasOverallBudget: false };
  }
}

// ─── Safe-to-Spend ──────────────────────────────────────────────

export async function getSafeToSpendToday() {
  try {
    const budget = await getBudgetStatus();
    if (!budget.hasOverallBudget) return null;

    const todayData = await getTodaySpend();
    const safeAmount = Math.max(0, budget.dailyAllowance - todayData.total);

    return {
      amount: safeAmount,
      dailyAllowance: budget.dailyAllowance,
      todaySpent: todayData.total,
      daysLeft: budget.daysLeft,
      isOverToday: todayData.total > budget.dailyAllowance,
      overAmount: Math.max(0, todayData.total - budget.dailyAllowance),
    };
  } catch {
    return null;
  }
}

// ─── Spending Score (0-100) ─────────────────────────────────────

export async function getSpendingScore() {
  try {
    const budget = await getBudgetStatus();
    const monthData = await getMonthSpend();
    const lastMonthData = await getLastMonthSpend();

    if (monthData.count < 5) return null; // Not enough data

    let score = 70; // Start neutral

    // Budget factor (±20 points)
    if (budget.hasOverallBudget) {
      if (budget.percentUsed <= 50) score += 15;
      else if (budget.percentUsed <= 75) score += 10;
      else if (budget.percentUsed <= 90) score += 5;
      else if (budget.percentUsed <= 100) score -= 5;
      else score -= 15;
    }

    // Month-over-month trend (±15 points)
    if (lastMonthData.total > 0) {
      const change = safePercent(monthData.total - lastMonthData.total, lastMonthData.total);
      if (change < -15) score += 15;
      else if (change < -5) score += 8;
      else if (change < 5) score += 3;
      else if (change < 15) score -= 5;
      else score -= 10;
    }

    // Clamp
    score = Math.max(0, Math.min(100, Math.round(score)));

    let label;
    if (score >= 85) label = 'Excellent spending discipline';
    else if (score >= 70) label = 'Spending is well managed';
    else if (score >= 55) label = 'Room for improvement';
    else label = 'Spending needs attention';

    return { score, label };
  } catch {
    return null;
  }
}

// ─── Payment Method Breakdown ───────────────────────────────────

export async function getPaymentMethodBreakdown() {
  try {
    const start = startOfMonth().toISOString();
    const expenses = await getAllExpenses({ startDate: start, limit: 5000 });
    const methods = {};
    let total = 0;

    (expenses || []).forEach((e) => {
      const method = e.payment_method || 'Other';
      if (!methods[method]) methods[method] = { name: method, total: 0, count: 0 };
      const amt = parseFloat(e.expense) || 0;
      methods[method].total += amt;
      methods[method].count += 1;
      total += amt;
    });

    return Object.values(methods)
      .map((m) => ({ ...m, percent: total > 0 ? (m.total / total) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);
  } catch {
    return [];
  }
}

// ─── Merchant Intelligence ──────────────────────────────────────

export async function getMerchantInsights(limit = 10) {
  try {
    const start = startOfMonth().toISOString();
    const lastStart = startOfLastMonth().toISOString();
    const lastEnd = endOfLastMonth().toISOString();

    const [currentExpenses, lastMonthExpenses] = await Promise.all([
      getAllExpenses({ startDate: start, limit: 5000 }),
      getAllExpenses({ startDate: lastStart, endDate: lastEnd, limit: 5000 }),
    ]);

    const currentMerchants = {};
    (currentExpenses || []).forEach((e) => {
      const m = (e.merchant || '').trim();
      if (!m) return;
      if (!currentMerchants[m]) currentMerchants[m] = { name: m, total: 0, count: 0, category: e.category };
      currentMerchants[m].total += parseFloat(e.expense) || 0;
      currentMerchants[m].count += 1;
    });

    const lastMerchants = {};
    (lastMonthExpenses || []).forEach((e) => {
      const m = (e.merchant || '').trim();
      if (!m) return;
      if (!lastMerchants[m]) lastMerchants[m] = { total: 0, count: 0 };
      lastMerchants[m].total += parseFloat(e.expense) || 0;
      lastMerchants[m].count += 1;
    });

    return Object.values(currentMerchants)
      .map((m) => {
        const last = lastMerchants[m.name];
        return {
          ...m,
          average: m.count > 0 ? m.total / m.count : 0,
          lastMonthTotal: last?.total || 0,
          lastMonthCount: last?.count || 0,
          change: last?.total > 0
            ? ((m.total - last.total) / last.total) * 100
            : null,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);
  } catch {
    return [];
  }
}

// ─── Anomaly Detection ──────────────────────────────────────────

export async function getSpendingAnomalies() {
  try {
    const expenses = await getAllExpenses({ limit: 1000, sortBy: 'date_time', sortOrder: 'DESC' });
    if (!expenses || expenses.length < 10) return [];

    // Group by category and compute stats
    const categoryStats = {};
    expenses.forEach((e) => {
      const cat = e.category || 'Other';
      if (!categoryStats[cat]) categoryStats[cat] = [];
      categoryStats[cat].push(parseFloat(e.expense) || 0);
    });

    const anomalies = [];

    // Check recent transactions (last 5) against category averages
    const recentExpenses = expenses.slice(0, 5);
    recentExpenses.forEach((e) => {
      const cat = e.category || 'Other';
      const amounts = categoryStats[cat] || [];
      if (amounts.length < 5) return;

      const avg = amounts.reduce((s, v) => s + v, 0) / amounts.length;
      const amount = parseFloat(e.expense) || 0;

      if (amount > avg * 2.5 && amount > 100) {
        anomalies.push({
          expense: e,
          avgForCategory: avg,
          ratio: amount / avg,
          message: `${formatINR(amount, { showPaise: false })} is significantly higher than your usual ${cat} spending (avg ${formatINR(avg, { showPaise: false })}).`,
        });
      }
    });

    return anomalies.slice(0, 3);
  } catch {
    return [];
  }
}

// ─── Weekly Digest ──────────────────────────────────────────────

export async function getWeeklyDigest() {
  try {
    const weekData = await getWeekSpend();
    const lastWeekData = await getLastWeekSpend();
    const start = startOfWeek().toISOString();
    const breakdown = await getCategoryBreakdown(start);
    const dailyAvg = weekData.count > 0 ? weekData.total / Math.max(1, daysBetween(startOfWeek(), new Date())) : 0;
    const topCat = breakdown && breakdown.length > 0 ? breakdown[0] : null;

    const changePercent = lastWeekData.total > 0
      ? ((weekData.total - lastWeekData.total) / lastWeekData.total) * 100
      : null;

    return {
      total: weekData.total,
      count: weekData.count,
      dailyAvg,
      topCategory: topCat,
      changePercent,
      lastWeekTotal: lastWeekData.total,
      categoryBreakdown: breakdown || [],
    };
  } catch {
    return { total: 0, count: 0, dailyAvg: 0, topCategory: null, changePercent: null, lastWeekTotal: 0, categoryBreakdown: [] };
  }
}

// ─── Monthly Recap ──────────────────────────────────────────────

export async function getMonthlyRecap() {
  try {
    const monthData = await getMonthSpend();
    const lastMonthData = await getLastMonthSpend();
    const budget = await getBudgetStatus();
    const breakdown = await getMonthCategoryBreakdown();
    const topCat = breakdown && breakdown.length > 0 ? breakdown[0] : null;
    const dailyAvg = await getMonthlyDailyAverage();

    const changePercent = lastMonthData.total > 0
      ? ((monthData.total - lastMonthData.total) / lastMonthData.total) * 100
      : null;

    const monthName = new Date().toLocaleDateString('en-IN', { month: 'long' });

    return {
      monthName,
      total: monthData.total,
      count: monthData.count,
      dailyAvg,
      topCategory: topCat,
      changePercent,
      lastMonthTotal: lastMonthData.total,
      budget,
      categoryBreakdown: breakdown || [],
    };
  } catch {
    return null;
  }
}

// ─── Spending Summary (natural language) ────────────────────────

export async function getSpendingSummary() {
  try {
    const weekData = await getWeekSpend();
    const lastWeekData = await getLastWeekSpend();
    const breakdown = await getCategoryBreakdown(startOfWeek().toISOString());

    if (weekData.count === 0) return null;

    const changePercent = lastWeekData.total > 0
      ? ((weekData.total - lastWeekData.total) / lastWeekData.total) * 100
      : null;

    const topCategories = (breakdown || []).slice(0, 4).map(c => ({
      name: c.category,
      total: c.total,
    }));

    return {
      total: weekData.total,
      count: weekData.count,
      period: 'this week',
      changePercent,
      direction: changePercent !== null ? (changePercent > 0 ? 'more' : 'less') : null,
      topCategories,
    };
  } catch {
    return null;
  }
}

// ─── Payment Method Analytics ───────────────────────────────────

export async function getPaymentMethodAnalytics() {
  try {
    const start = startOfMonth().toISOString();
    const rows = await getDbPaymentBreakdown(start);
    const monthData = await getMonthSpend();

    return (rows || []).map((r) => ({
      method: r.method || 'UPI',
      total: r.total,
      count: r.count,
      percent: safePercent(r.total, monthData.total),
    }));
  } catch {
    return [];
  }
}

// ─── Unusual Spending Detection ─────────────────────────────────

export async function detectUnusualSpending(expenseAmount, categoryName) {
  try {
    const numericAmount = parseFloat(expenseAmount);
    if (isNaN(numericAmount) || numericAmount <= 0) return { isUnusual: false };

    const expenses = await getAllExpenses({ limit: 100 });
    if (!expenses || expenses.length < 5) return { isUnusual: false };

    // Filter by category or overall
    const categoryExpenses = expenses.filter(
      (e) => (e.category || '').toLowerCase() === (categoryName || '').toLowerCase()
    );
    const targetSet = categoryExpenses.length >= 3 ? categoryExpenses : expenses;

    const sum = targetSet.reduce((acc, curr) => acc + (curr.expense || 0), 0);
    const avg = sum / targetSet.length;

    // Trigger if transaction is > 2.5x the normal historical average for this group
    const isUnusual = numericAmount >= avg * 2.5 && numericAmount >= 500;

    return {
      isUnusual,
      average: avg,
      multiplier: avg > 0 ? (numericAmount / avg).toFixed(1) : 1,
    };
  } catch {
    return { isUnusual: false };
  }
}

// ─── Insights Engine ────────────────────────────────────────────

export async function generateInsights() {
  const insights = [];

  try {
    const monthData = await getMonthSpend();
    const lastMonthData = await getLastMonthSpend();
    const dailyAvg = await getMonthlyDailyAverage();
    const todayData = await getTodaySpend();
    const topCat = await getTopCategory();
    const largest = await getMonthLargestExpense();
    const budget = await getBudgetStatus();
    const weekData = await getWeekSpend();
    const lastWeekData = await getLastWeekSpend();

    // Month-over-month comparison
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

    // Week-over-week comparison
    if (lastWeekData.total > 0 && weekData.total > 0) {
      const weekChange = safePercent(weekData.total - lastWeekData.total, lastWeekData.total);
      if (Math.abs(weekChange) >= 15) {
        const dir = weekChange > 0 ? 'more' : 'less';
        insights.push({
          type: 'week_trend',
          text: `This week's spending is ${Math.abs(weekChange).toFixed(0)}% ${dir} than last week.`,
          severity: weekChange > 25 ? 'warning' : weekChange < -15 ? 'success' : 'info',
        });
      }
    }

    // Top category share
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

    // Largest expense
    if (largest && largest.expense >= 500) {
      insights.push({
        type: 'largest',
        text: `Your largest expense was ${formatINR(largest.expense, { showPaise: false })} on ${largest.merchant || largest.category}.`,
        severity: 'info',
      });
    }

    // Today vs average
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

    // Budget status
    if (budget.hasOverallBudget) {
      if (budget.isOverBudget) {
        insights.push({
          type: 'budget',
          text: `You're ${formatINR(budget.overAmount, { showPaise: false })} above your monthly budget.`,
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

    // Daily average insight
    if (dailyAvg > 0) {
      insights.push({
        type: 'average',
        text: `Your average daily spending this month is ${formatINR(dailyAvg, { showPaise: false })}.`,
        severity: 'info',
      });
    }
  } catch (error) {
    console.error('[Analytics] Error generating insights:', error);
  }

  return insights;
}

// ─── Full Dashboard Data ────────────────────────────────────────

export async function getDashboardData() {
  try {
    const [
      today, week, month, lastMonth, dailyAvg, breakdown, topCat, largest, budget,
      insightsData, score, safeToSpend, weekDigest, summary, merchants, paymentMethods, monthlyRecapData
    ] = await Promise.all([
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
      getSpendingScore().catch(() => null),
      getSafeToSpendToday().catch(() => null),
      getWeeklyDigest().catch(() => null),
      getSpendingSummary().catch(() => null),
      getMerchantInsights().catch(() => []),
      getPaymentMethodAnalytics().catch(() => []),
      getMonthlyRecap().catch(() => null),
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
      spendingScore: score,
      safeToSpend,
      weekDigest,
      summary,
      merchantInsights: merchants || [],
      paymentAnalytics: paymentMethods || [],
      monthlyRecap: monthlyRecapData,
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
      spendingScore: null,
      safeToSpend: null,
      weekDigest: null,
      summary: null,
    };
  }
}
