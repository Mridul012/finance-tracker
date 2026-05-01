const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function computeMonthlyReport(userId, month, year) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const [incomeAgg, expenseAgg, expenseGroups, incomeGroups, transactionCount] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId, type: 'INCOME', date: { gte: startDate, lt: endDate } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, type: 'EXPENSE', date: { gte: startDate, lt: endDate } },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { userId, type: 'EXPENSE', date: { gte: startDate, lt: endDate } },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { userId, type: 'INCOME', date: { gte: startDate, lt: endDate } },
      _sum: { amount: true },
    }),
    prisma.transaction.count({
      where: { userId, date: { gte: startDate, lt: endDate } },
    }),
  ]);

  const totalIncome = parseFloat(incomeAgg._sum.amount) || 0;
  const totalExpenses = parseFloat(expenseAgg._sum.amount) || 0;
  const netSavings = totalIncome - totalExpenses;

  const categoryIds = [
    ...new Set(
      [...expenseGroups, ...incomeGroups].map((g) => g.categoryId).filter(Boolean)
    ),
  ];

  const categories = categoryIds.length
    ? await prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true },
      })
    : [];
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  const mapGroup = (g) => ({
    categoryId: g.categoryId,
    categoryName: g.categoryId ? catMap[g.categoryId] || 'Unknown' : 'Uncategorized',
    total: parseFloat(g._sum.amount) || 0,
  });

  return {
    month,
    year,
    totalIncome,
    totalExpenses,
    netSavings,
    expenseByCategory: expenseGroups.map(mapGroup),
    incomeByCategory: incomeGroups.map(mapGroup),
    transactionCount,
  };
}

const getMonthlyReport = async (req, res, next) => {
  const now = new Date();
  const month = parseInt(req.query.month) || now.getMonth() + 1;
  const year = parseInt(req.query.year) || now.getFullYear();

  try {
    const report = await computeMonthlyReport(req.user.id, month, year);
    res.json(report);
  } catch (err) {
    next(err);
  }
};

const getDashboard = async (req, res, next) => {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const startDate = new Date(currentYear, currentMonth - 1, 1);
  const endDate = new Date(currentYear, currentMonth, 1);

  const last6Spec = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(currentYear, currentMonth - 1 - (5 - i), 1);
    return { month: d.getMonth() + 1, year: d.getFullYear() };
  });

  try {
    const [currentMonthReport, last6Full, budgets, recentTransactions] = await Promise.all([
      computeMonthlyReport(req.user.id, currentMonth, currentYear),
      Promise.all(last6Spec.map(({ month, year }) => computeMonthlyReport(req.user.id, month, year))),
      prisma.budget.findMany({
        where: { userId: req.user.id, month: currentMonth, year: currentYear },
        include: { category: { select: { name: true } } },
      }),
      prisma.transaction.findMany({
        where: { userId: req.user.id },
        include: { category: { select: { name: true } } },
        orderBy: { date: 'desc' },
        take: 5,
      }),
    ]);

    const last6Months = last6Full.map(({ month, year, totalIncome, totalExpenses, netSavings }) => ({
      month,
      year,
      totalIncome,
      totalExpenses,
      netSavings,
    }));

    const budgetAlerts = (
      await Promise.all(
        budgets.map(async (budget) => {
          const agg = await prisma.transaction.aggregate({
            where: {
              userId: req.user.id,
              categoryId: budget.categoryId,
              type: 'EXPENSE',
              date: { gte: startDate, lt: endDate },
            },
            _sum: { amount: true },
          });
          const totalSpent = parseFloat(agg._sum.amount) || 0;
          const budgetAmount = parseFloat(budget.amount);
          return {
            id: budget.id,
            categoryId: budget.categoryId,
            category: budget.category,
            month: budget.month,
            year: budget.year,
            budgetAmount,
            totalSpent,
          };
        })
      )
    ).filter((b) => b.totalSpent > b.budgetAmount);

    res.json({
      currentMonth: currentMonthReport,
      last6Months,
      budgetAlerts,
      recentTransactions: recentTransactions.map((t) => ({ ...t, amount: parseFloat(t.amount) })),
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getMonthlyReport, getDashboard };
