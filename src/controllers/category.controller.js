const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const getAll = async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({ where: { userId: req.user.id } });
    res.json({ categories });
  } catch (err) {
    next(err);
  }
};

const getOne = async (req, res, next) => {
  try {
    const category = await prisma.category.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!category) return res.status(404).json({ error: 'Category not found' });
    res.json({ category });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  const { name, type } = req.body;
  if (!name || !['INCOME', 'EXPENSE'].includes(type)) {
    return res.status(400).json({ error: 'name and type (INCOME or EXPENSE) are required' });
  }
  try {
    const category = await prisma.category.create({
      data: { name, type, userId: req.user.id },
    });
    res.status(201).json({ category });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const existing = await prisma.category.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ error: 'Category not found' });

    const { name, type } = req.body;
    if (type && !['INCOME', 'EXPENSE'].includes(type)) {
      return res.status(400).json({ error: 'type must be INCOME or EXPENSE' });
    }

    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: { ...(name && { name }), ...(type && { type }) },
    });
    res.json({ category });
  } catch (err) {
    next(err);
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    const existing = await prisma.category.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ error: 'Category not found' });

    await prisma.transaction.updateMany({
      where: { categoryId: req.params.id },
      data: { categoryId: null },
    });
    await prisma.category.delete({ where: { id: req.params.id } });
    res.json({ message: 'Category deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getOne, create, update, deleteCategory };
