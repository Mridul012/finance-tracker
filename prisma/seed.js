const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'test@test.com' },
    create: { email: 'test@test.com', password: hashedPassword, name: 'Test User' },
    update: { password: hashedPassword, name: 'Test User' },
  });
  console.log('User:', user.email);

  const categoryDefs = [
    { name: 'Salary', type: 'INCOME' },
    { name: 'Freelance', type: 'INCOME' },
    { name: 'Food', type: 'EXPENSE' },
    { name: 'Rent', type: 'EXPENSE' },
    { name: 'Transport', type: 'EXPENSE' },
    { name: 'Entertainment', type: 'EXPENSE' },
  ];

  const cats = {};
  for (const def of categoryDefs) {
    const c = await prisma.category.upsert({
      where: { name_userId: { name: def.name, userId: user.id } },
      create: { ...def, userId: user.id },
      update: {},
    });
    cats[def.name] = c;
  }
  console.log('Categories:', Object.keys(cats).join(', '));

  await prisma.transaction.deleteMany({ where: { userId: user.id } });

  const now = new Date();
  const cy = now.getFullYear();
  const cm = now.getMonth(); // 0-indexed

  const d = (monthOffset, day) => new Date(cy, cm + monthOffset, day);

  const txns = [
    // 3 months ago
    { amount: 3000,  description: 'Monthly Salary',      date: d(-3, 1),  type: 'INCOME',  categoryId: cats['Salary'].id },
    { amount: 1500,  description: 'Rent Payment',        date: d(-3, 2),  type: 'EXPENSE', categoryId: cats['Rent'].id },
    { amount: 320,   description: 'Groceries',           date: d(-3, 8),  type: 'EXPENSE', categoryId: cats['Food'].id },
    { amount: 100,   description: 'Bus Pass',            date: d(-3, 10), type: 'EXPENSE', categoryId: cats['Transport'].id },
    { amount: 450,   description: 'Freelance Project',   date: d(-3, 15), type: 'INCOME',  categoryId: cats['Freelance'].id },
    { amount: 75,    description: 'Movie Night',         date: d(-3, 20), type: 'EXPENSE', categoryId: cats['Entertainment'].id },
    // 2 months ago
    { amount: 3000,  description: 'Monthly Salary',      date: d(-2, 1),  type: 'INCOME',  categoryId: cats['Salary'].id },
    { amount: 1500,  description: 'Rent Payment',        date: d(-2, 2),  type: 'EXPENSE', categoryId: cats['Rent'].id },
    { amount: 410,   description: 'Groceries & Dining',  date: d(-2, 7),  type: 'EXPENSE', categoryId: cats['Food'].id },
    { amount: 130,   description: 'Fuel',                date: d(-2, 12), type: 'EXPENSE', categoryId: cats['Transport'].id },
    { amount: 300,   description: 'Freelance Design',    date: d(-2, 14), type: 'INCOME',  categoryId: cats['Freelance'].id },
    { amount: 150,   description: 'Concert Tickets',     date: d(-2, 18), type: 'EXPENSE', categoryId: cats['Entertainment'].id },
    { amount: 80,    description: 'Restaurant',          date: d(-2, 25), type: 'EXPENSE', categoryId: cats['Food'].id },
    // Last month
    { amount: 3000,  description: 'Monthly Salary',      date: d(-1, 1),  type: 'INCOME',  categoryId: cats['Salary'].id },
    { amount: 1500,  description: 'Rent Payment',        date: d(-1, 2),  type: 'EXPENSE', categoryId: cats['Rent'].id },
    { amount: 350,   description: 'Groceries',           date: d(-1, 8),  type: 'EXPENSE', categoryId: cats['Food'].id },
    { amount: 115,   description: 'Uber & Transit',      date: d(-1, 15), type: 'EXPENSE', categoryId: cats['Transport'].id },
    { amount: 600,   description: 'Freelance Web Dev',   date: d(-1, 22), type: 'INCOME',  categoryId: cats['Freelance'].id },
    { amount: 95,    description: 'Streaming Services',  date: d(-1, 25), type: 'EXPENSE', categoryId: cats['Entertainment'].id },
    { amount: 90,    description: 'Lunch & Coffee',      date: d(-1, 28), type: 'EXPENSE', categoryId: cats['Food'].id },
  ];

  await prisma.transaction.createMany({
    data: txns.map((t) => ({ ...t, userId: user.id, currency: 'USD' })),
  });
  console.log(`Transactions: ${txns.length} created`);

  // Budgets for current month — delete first to avoid categoryId @unique conflicts on re-seed
  await prisma.budget.deleteMany({ where: { userId: user.id } });
  const budgetDefs = [
    { categoryId: cats['Food'].id, amount: 500 },
    { categoryId: cats['Rent'].id, amount: 1500 },
    { categoryId: cats['Transport'].id, amount: 200 },
  ];
  await prisma.budget.createMany({
    data: budgetDefs.map((b) => ({
      ...b,
      month: now.getMonth() + 1,
      year: cy,
      userId: user.id,
    })),
  });
  console.log(`Budgets: ${budgetDefs.length} created for ${now.getMonth() + 1}/${cy}`);
  console.log('Seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
