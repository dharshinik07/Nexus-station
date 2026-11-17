import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding demo data into FreelanceVault...');

  // Hash demo password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('DemoPassword123!', salt);

  // 1. Create Demo User
  const demoUser = await prisma.user.upsert({
    where: { email: 'freelancer@vault.dev' },
    update: {},
    create: {
      email: 'freelancer@vault.dev',
      fullName: 'Alex Vance',
      passwordHash,
      isEmailVerified: true,
      role: 'OWNER',
    },
  });

  console.log(`Created/Verified demo user: ${demoUser.email}`);

  // 2. Settings
  await prisma.setting.upsert({
    where: { userId: demoUser.id },
    update: {},
    create: {
      userId: demoUser.id,
      businessName: 'Vance Design & Engineering Studio',
      email: 'alex@vancestudio.dev',
      currency: 'USD',
      invoicePrefix: 'INV-',
      nextInvoiceNumber: 1005,
      taxType: 'GST',
      defaultTaxRate: 10,
    },
  });

  // 3. Expense Categories
  const categories = [
    { name: 'Software and Subscriptions', color: '#3b82f6' },
    { name: 'Equipment', color: '#10b981' },
    { name: 'Travel', color: '#f59e0b' },
    { name: 'Food and Meals', color: '#ec4899' },
    { name: 'Internet and Phone', color: '#8b5cf6' },
    { name: 'Rent/Coworking', color: '#06b6d4' },
    { name: 'Marketing', color: '#f97316' },
    { name: 'Education', color: '#6366f1' },
    { name: 'Professional Fees', color: '#14b8a6' },
    { name: 'Taxes', color: '#ef4444' },
    { name: 'Bank Charges', color: '#64748b' },
    { name: 'Other', color: '#94a3b8' },
  ];

  for (const cat of categories) {
    const existing = await prisma.expenseCategory.findFirst({
      where: { userId: demoUser.id, name: cat.name },
    });
    if (!existing) {
      await prisma.expenseCategory.create({
        data: {
          userId: demoUser.id,
          name: cat.name,
          color: cat.color,
          isSystem: true,
        },
      });
    }
  }

  // 4. Clients
  const acmeClient = await prisma.client.create({
    data: {
      userId: demoUser.id,
      name: 'Sarah Connor',
      company: 'Acme Corporation',
      email: 'sarah@acme.com',
      phone: '+1 555-0192',
      address: '100 Tech Blvd, Suite 400, San Francisco, CA',
      notes: 'Key client for cloud migrations and front-end architecture.',
      status: 'ACTIVE',
      tags: 'Enterprise,Retainer',
    },
  });

  const novaClient = await prisma.client.create({
    data: {
      userId: demoUser.id,
      name: 'Marcus Brody',
      company: 'Nova Interactive',
      email: 'marcus@novainteractive.io',
      phone: '+1 555-0381',
      address: '250 Broadway, New York, NY',
      notes: 'Mobile app project client.',
      status: 'ACTIVE',
      tags: 'Design,Mobile',
    },
  });

  // 5. Projects
  const cloudProject = await prisma.project.create({
    data: {
      userId: demoUser.id,
      clientId: acmeClient.id,
      title: 'Cloud Infrastructure Modernization',
      description: 'Migrating legacy monolith into micro-services and modern React dashboard.',
      status: 'IN_PROGRESS',
      billingType: 'FIXED',
      budget: 18500,
      rate: 120,
      startDate: new Date('2026-01-10'),
      endDate: new Date('2026-06-30'),
    },
  });

  const mobileProject = await prisma.project.create({
    data: {
      userId: demoUser.id,
      clientId: novaClient.id,
      title: 'Mobile App UX Redesign',
      description: 'End-to-end design system and prototype implementation.',
      status: 'IN_PROGRESS',
      billingType: 'HOURLY',
      budget: 9500,
      rate: 95,
      startDate: new Date('2026-02-01'),
      endDate: new Date('2026-05-15'),
    },
  });

  // 6. Invoices & Items
  const invoice1 = await prisma.invoice.create({
    data: {
      userId: demoUser.id,
      clientId: acmeClient.id,
      projectId: cloudProject.id,
      invoiceNumber: 'INV-1001',
      issueDate: new Date('2026-01-20'),
      dueDate: new Date('2026-02-05'),
      status: 'PAID',
      subtotal: 5000,
      taxRate: 10,
      taxAmount: 500,
      total: 5500,
      amountPaid: 5500,
      notes: 'Phase 1 Architecture milestone.',
      items: {
        create: [
          { description: 'Architecture & Cloud Migration Planning', quantity: 1, unitPrice: 3500, total: 3500 },
          { description: 'DevOps CI/CD setup', quantity: 1, unitPrice: 1500, total: 1500 },
        ],
      },
    },
  });

  // Payment for invoice1
  await prisma.payment.create({
    data: {
      userId: demoUser.id,
      invoiceId: invoice1.id,
      amount: 5500,
      paymentDate: new Date('2026-02-02'),
      paymentMethod: 'BANK_TRANSFER',
      reference: 'WIRE-9928172',
      notes: 'Paid in full on time.',
    },
  });

  const invoice2 = await prisma.invoice.create({
    data: {
      userId: demoUser.id,
      clientId: novaClient.id,
      projectId: mobileProject.id,
      invoiceNumber: 'INV-1002',
      issueDate: new Date('2026-02-15'),
      dueDate: new Date('2026-03-01'),
      status: 'SENT',
      subtotal: 3800,
      taxRate: 10,
      taxAmount: 380,
      total: 4180,
      amountPaid: 1000,
      notes: 'Initial UX wireframes and user testing round 1.',
      items: {
        create: [
          { description: 'Design System & Figma Tokens', quantity: 20, unitPrice: 95, total: 1900 },
          { description: 'Mobile Prototype & Usability Testing', quantity: 20, unitPrice: 95, total: 1900 },
        ],
      },
    },
  });

  await prisma.payment.create({
    data: {
      userId: demoUser.id,
      invoiceId: invoice2.id,
      amount: 1000,
      paymentDate: new Date('2026-02-25'),
      paymentMethod: 'STRIPE',
      reference: 'ch_3N8x7728',
      notes: 'Initial deposit received.',
    },
  });

  // 7. Expenses
  await prisma.expense.createMany({
    data: [
      {
        userId: demoUser.id,
        vendor: 'Figma Inc.',
        categoryName: 'Software and Subscriptions',
        amount: 45.0,
        currency: 'USD',
        description: 'Monthly Organization license',
        expenseDate: new Date('2026-02-01'),
        paymentMethod: 'CARD',
        isBillable: false,
        isTaxDeductible: true,
        tags: 'Design,Monthly',
      },
      {
        userId: demoUser.id,
        vendor: 'Amazon Web Services',
        categoryName: 'Software and Subscriptions',
        amount: 185.2,
        currency: 'USD',
        description: 'Staging and testing servers for Acme project',
        expenseDate: new Date('2026-02-05'),
        paymentMethod: 'CARD',
        clientId: acmeClient.id,
        projectId: cloudProject.id,
        isBillable: true,
        isTaxDeductible: true,
        tags: 'Cloud,Hosting',
      },
      {
        userId: demoUser.id,
        vendor: 'WeWork Office Space',
        categoryName: 'Rent/Coworking',
        amount: 450.0,
        currency: 'USD',
        description: 'Dedicated desk membership',
        expenseDate: new Date('2026-02-01'),
        paymentMethod: 'BANK_TRANSFER',
        isBillable: false,
        isTaxDeductible: true,
      },
      {
        userId: demoUser.id,
        vendor: 'Apple Store',
        categoryName: 'Equipment',
        amount: 1299.0,
        currency: 'USD',
        description: 'New workstation display for client presentations',
        expenseDate: new Date('2026-01-15'),
        paymentMethod: 'CARD',
        isBillable: false,
        isTaxDeductible: true,
        tags: 'Hardware,Asset',
      },
    ],
  });

  // 8. Reminders
  await prisma.reminder.createMany({
    data: [
      {
        userId: demoUser.id,
        title: 'Q1 Estimated Tax Payment Due',
        reminderType: 'TAX_DEADLINE',
        dueDate: new Date('2026-04-15'),
        notes: 'File federal and state quarterly estimates.',
      },
      {
        userId: demoUser.id,
        title: 'Follow up on Invoice INV-1002 (Nova Interactive)',
        reminderType: 'INVOICE_DUE',
        dueDate: new Date('2026-03-01'),
        notes: 'Send friendly payment reminder for remaining balance $3,180.',
      },
    ],
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
