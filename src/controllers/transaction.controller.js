const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const getAll = async (req, res, next) => {
  const { type, categoryId, startDate, endDate, currency } = req.query;

  const where = { userId: req.user.id };
  if (type) where.type = type;
  if (categoryId) where.categoryId = categoryId;
  if (currency) where.currency = currency.toUpperCase();
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
  }

  try {
    const transactions = await prisma.transaction.findMany({
      where,
      include: { category: { select: { name: true } } },
      orderBy: { date: 'desc' },
    });
    res.json({ transactions });
  } catch (err) {
    next(err);
  }
};

const getOne = async (req, res, next) => {
  try {
    const transaction = await prisma.transaction.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { category: true },
    });
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    res.json({ transaction });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  const { amount, description, date, type, currency, categoryId } = req.body;

  if (amount === undefined || !description || !date || !['INCOME', 'EXPENSE'].includes(type)) {
    return res.status(400).json({ error: 'amount, description, date, and type are required' });
  }

  try {
    const transaction = await prisma.transaction.create({
      data: {
        amount,
        description,
        date: new Date(date),
        type,
        currency: (currency || 'USD').toUpperCase(),
        categoryId: categoryId || null,
        userId: req.user.id,
      },
      include: { category: { select: { name: true } } },
    });
    res.status(201).json({ transaction });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const existing = await prisma.transaction.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ error: 'Transaction not found' });

    const { amount, description, date, type, currency, categoryId } = req.body;
    if (type && !['INCOME', 'EXPENSE'].includes(type)) {
      return res.status(400).json({ error: 'type must be INCOME or EXPENSE' });
    }

    const transaction = await prisma.transaction.update({
      where: { id: req.params.id },
      data: {
        ...(amount !== undefined && { amount }),
        ...(description && { description }),
        ...(date && { date: new Date(date) }),
        ...(type && { type }),
        ...(currency && { currency: currency.toUpperCase() }),
        ...('categoryId' in req.body && { categoryId: categoryId || null }),
      },
      include: { category: { select: { name: true } } },
    });
    res.json({ transaction });
  } catch (err) {
    next(err);
  }
};

const deleteTransaction = async (req, res, next) => {
  try {
    const existing = await prisma.transaction.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ error: 'Transaction not found' });

    await prisma.transaction.delete({ where: { id: req.params.id } });
    res.json({ message: 'Transaction deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getOne, create, update, deleteTransaction };
