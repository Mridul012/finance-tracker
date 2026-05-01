const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const getAll = async (req, res, next) => {
  const now = new Date();
  const month = parseInt(req.query.month) || now.getMonth() + 1;
  const year = parseInt(req.query.year) || now.getFullYear();

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  try {
    const budgets = await prisma.budget.findMany({
      where: { userId: req.user.id, month, year },
      include: { category: { select: { name: true, type: true } } },
    });

    const result = await Promise.all(
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

        const totalSpent = Number(agg._sum.amount) || 0;
        const budgetAmount = Number(budget.amount);
        const percentageUsed =
          budgetAmount > 0 ? Math.round((totalSpent / budgetAmount) * 10000) / 100 : 0;

        return {
          ...budget,
          budgetAmount,
          totalSpent,
          percentageUsed,
          isOverBudget: totalSpent > budgetAmount,
        };
      })
    );

    res.json({ budgets: result, month, year });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  const { amount, month, year, categoryId } = req.body;

  if (!amount || !month || !year || !categoryId) {
    return res.status(400).json({ error: 'amount, month, year, and categoryId are required' });
  }

  try {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, userId: req.user.id },
    });
    if (!category) return res.status(404).json({ error: 'Category not found' });

    const budget = await prisma.budget.upsert({
      where: { categoryId_month_year: { categoryId, month: parseInt(month), year: parseInt(year) } },
      create: {
        amount,
        month: parseInt(month),
        year: parseInt(year),
        categoryId,
        userId: req.user.id,
      },
      update: { amount },
    });

    res.status(201).json({ budget });
  } catch (err) {
    next(err);
  }
};

const deleteBudget = async (req, res, next) => {
  try {
    const existing = await prisma.budget.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ error: 'Budget not found' });

    await prisma.budget.delete({ where: { id: req.params.id } });
    res.json({ message: 'Budget deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, create, deleteBudget };
