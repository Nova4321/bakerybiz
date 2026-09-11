/**
 * BakeryBiz — Database Seed Script
 *
 * Populates the database with realistic sample data so the app is immediately
 * functional after deployment.
 *
 * Usage:
 *   DATABASE_URL=<your-url> pnpm --filter scripts run seed
 *   — or —
 *   npx tsx scripts/src/seed.ts   (with DATABASE_URL set)
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import {
  categoriesTable,
  productsTable,
  customersTable,
  suppliersTable,
  expensesTable,
  ordersTable,
  orderItemsTable,
  auditLogsTable,
} from "../../lib/db/src/schema/index";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("❌  DATABASE_URL is not set. Aborting seed.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// ---------------------------------------------------------------------------
// Seed Data
// ---------------------------------------------------------------------------

const categories = [
  { name: "Breads", color: "#E07A5F" },
  { name: "Cakes", color: "#81B29A" },
  { name: "Pastries", color: "#F2CC8F" },
  { name: "Cookies", color: "#3D405B" },
  { name: "Beverages", color: "#5E81AC" },
];

const products = [
  // Breads (categoryId will be filled in dynamically)
  { name: "Whole Wheat Bread", sku: "BRD-001", categoryIndex: 0, price: 45, cost: 25, stock: 50, minStock: 10, unit: "loaf" },
  { name: "Multigrain Bread", sku: "BRD-002", categoryIndex: 0, price: 55, cost: 30, stock: 40, minStock: 10, unit: "loaf" },
  { name: "Sourdough Bread", sku: "BRD-003", categoryIndex: 0, price: 85, cost: 45, stock: 25, minStock: 8, unit: "loaf" },
  { name: "Garlic Bread", sku: "BRD-004", categoryIndex: 0, price: 60, cost: 30, stock: 35, minStock: 10, unit: "pack" },
  // Cakes
  { name: "Chocolate Truffle Cake", sku: "CAK-001", categoryIndex: 1, price: 650, cost: 350, stock: 8, minStock: 3, unit: "piece" },
  { name: "Vanilla Sponge Cake", sku: "CAK-002", categoryIndex: 1, price: 450, cost: 220, stock: 10, minStock: 3, unit: "piece" },
  { name: "Red Velvet Cake", sku: "CAK-003", categoryIndex: 1, price: 750, cost: 400, stock: 5, minStock: 2, unit: "piece" },
  { name: "Pineapple Cake", sku: "CAK-004", categoryIndex: 1, price: 500, cost: 250, stock: 7, minStock: 3, unit: "piece" },
  // Pastries
  { name: "Croissant", sku: "PAS-001", categoryIndex: 2, price: 65, cost: 30, stock: 60, minStock: 15, unit: "piece" },
  { name: "Danish Pastry", sku: "PAS-002", categoryIndex: 2, price: 75, cost: 35, stock: 45, minStock: 12, unit: "piece" },
  { name: "Puff Pastry", sku: "PAS-003", categoryIndex: 2, price: 50, cost: 22, stock: 55, minStock: 15, unit: "piece" },
  { name: "Cinnamon Roll", sku: "PAS-004", categoryIndex: 2, price: 80, cost: 38, stock: 30, minStock: 10, unit: "piece" },
  // Cookies
  { name: "Chocolate Chip Cookie", sku: "COO-001", categoryIndex: 3, price: 30, cost: 12, stock: 100, minStock: 25, unit: "piece" },
  { name: "Butter Cookie", sku: "COO-002", categoryIndex: 3, price: 25, cost: 10, stock: 120, minStock: 30, unit: "piece" },
  { name: "Oatmeal Raisin Cookie", sku: "COO-003", categoryIndex: 3, price: 35, cost: 15, stock: 80, minStock: 20, unit: "piece" },
  // Beverages
  { name: "Filter Coffee", sku: "BEV-001", categoryIndex: 4, price: 40, cost: 15, stock: 200, minStock: 50, unit: "cup" },
  { name: "Masala Chai", sku: "BEV-002", categoryIndex: 4, price: 30, cost: 10, stock: 250, minStock: 60, unit: "cup" },
  { name: "Fresh Orange Juice", sku: "BEV-003", categoryIndex: 4, price: 60, cost: 25, stock: 100, minStock: 30, unit: "glass" },
];

const customers = [
  { name: "Raj Patel", phone: "+91 98765 43210", email: "raj@example.com" },
  { name: "Priya Sharma", phone: "+91 87654 32109", email: "priya@example.com" },
  { name: "Amit Gupta", phone: "+91 76543 21098", email: null },
  { name: "Sneha Reddy", phone: "+91 65432 10987", email: "sneha@example.com" },
  { name: "Vikram Singh", phone: "+91 54321 09876", email: null },
];

const suppliers = [
  { name: "Fresh Flour Mills", phone: "+91 99887 76655", email: "sales@freshflour.com", totalPurchases: 25000, outstanding: 5000 },
  { name: "Dairy Best", phone: "+91 88776 65544", email: "orders@dairybest.com", totalPurchases: 18000, outstanding: 3000 },
  { name: "Sugar & Spice Co.", phone: "+91 77665 54433", email: "info@sugarspice.com", totalPurchases: 12000, outstanding: 0 },
  { name: "Packaging World", phone: "+91 66554 43322", email: null, totalPurchases: 8000, outstanding: 2000 },
];

const expenses = [
  { category: "Ingredients", description: "Monthly flour purchase", amount: 8500, paymentMethod: "bank_transfer", expenseDate: "2026-09-08", vendor: "Fresh Flour Mills" },
  { category: "Utilities", description: "Electricity bill — August", amount: 4200, paymentMethod: "upi", expenseDate: "2026-09-05" },
  { category: "Ingredients", description: "Dairy supplies — butter, cream, milk", amount: 6300, paymentMethod: "bank_transfer", expenseDate: "2026-09-07", vendor: "Dairy Best" },
  { category: "Maintenance", description: "Oven maintenance and cleaning", amount: 2500, paymentMethod: "cash", expenseDate: "2026-09-06" },
  { category: "Packaging", description: "Boxes and bags restock", amount: 3200, paymentMethod: "upi", expenseDate: "2026-09-04", vendor: "Packaging World" },
];

// ---------------------------------------------------------------------------
// Seed execution
// ---------------------------------------------------------------------------

async function seed() {
  console.log("🌱  Seeding BakeryBiz database...\n");

  // 1. Categories
  console.log("  📂 Inserting categories...");
  const insertedCategories = await db
    .insert(categoriesTable)
    .values(categories)
    .returning();
  console.log(`     ✅ ${insertedCategories.length} categories created`);

  // 2. Products
  console.log("  🧁 Inserting products...");
  const productValues = products.map((p) => ({
    name: p.name,
    sku: p.sku,
    categoryId: insertedCategories[p.categoryIndex]!.id,
    price: p.price,
    cost: p.cost,
    stock: p.stock,
    minStock: p.minStock,
    unit: p.unit,
  }));
  const insertedProducts = await db
    .insert(productsTable)
    .values(productValues)
    .returning();
  console.log(`     ✅ ${insertedProducts.length} products created`);

  // 3. Customers
  console.log("  👥 Inserting customers...");
  const insertedCustomers = await db
    .insert(customersTable)
    .values(customers)
    .returning();
  console.log(`     ✅ ${insertedCustomers.length} customers created`);

  // 4. Suppliers
  console.log("  🏭 Inserting suppliers...");
  const insertedSuppliers = await db
    .insert(suppliersTable)
    .values(suppliers)
    .returning();
  console.log(`     ✅ ${insertedSuppliers.length} suppliers created`);

  // 5. Sample orders
  console.log("  🛒 Inserting sample orders...");
  const sampleOrders = [
    {
      orderNumber: `ORD-${Date.now() - 100000}`,
      status: "completed",
      channel: "offline",
      paymentMethod: "cash",
      customerId: insertedCustomers[0]!.id,
      subtotal: 240,
      discount: 0,
      tax: 0,
      total: 240,
    },
    {
      orderNumber: `ORD-${Date.now() - 50000}`,
      status: "completed",
      channel: "online",
      paymentMethod: "upi",
      customerId: insertedCustomers[1]!.id,
      subtotal: 715,
      discount: 15,
      tax: 0,
      total: 700,
    },
    {
      orderNumber: `ORD-${Date.now()}`,
      status: "preparing",
      channel: "offline",
      paymentMethod: "card",
      customerId: null,
      subtotal: 195,
      discount: 0,
      tax: 0,
      total: 195,
    },
  ];
  const insertedOrders = await db
    .insert(ordersTable)
    .values(sampleOrders)
    .returning();

  // Order items for the first order
  await db.insert(orderItemsTable).values([
    {
      orderId: insertedOrders[0]!.id,
      productId: insertedProducts[0]!.id,
      productName: insertedProducts[0]!.name,
      quantity: 2,
      unitPrice: 45,
      lineTotal: 90,
    },
    {
      orderId: insertedOrders[0]!.id,
      productId: insertedProducts[8]!.id,
      productName: insertedProducts[8]!.name,
      quantity: 2,
      unitPrice: 65,
      lineTotal: 130,
    },
    {
      orderId: insertedOrders[0]!.id,
      productId: insertedProducts[12]!.id,
      productName: insertedProducts[12]!.name,
      quantity: 1,
      unitPrice: 30,
      lineTotal: 30,
    },
  ]);

  // Order items for the second order
  await db.insert(orderItemsTable).values([
    {
      orderId: insertedOrders[1]!.id,
      productId: insertedProducts[4]!.id,
      productName: insertedProducts[4]!.name,
      quantity: 1,
      unitPrice: 650,
      lineTotal: 650,
    },
    {
      orderId: insertedOrders[1]!.id,
      productId: insertedProducts[8]!.id,
      productName: insertedProducts[8]!.name,
      quantity: 1,
      unitPrice: 65,
      lineTotal: 65,
    },
  ]);

  // Order items for the third order
  await db.insert(orderItemsTable).values([
    {
      orderId: insertedOrders[2]!.id,
      productId: insertedProducts[8]!.id,
      productName: insertedProducts[8]!.name,
      quantity: 3,
      unitPrice: 65,
      lineTotal: 195,
    },
  ]);
  console.log(`     ✅ ${insertedOrders.length} orders created with items`);

  // 6. Expenses
  console.log("  💰 Inserting expenses...");
  const insertedExpenses = await db
    .insert(expensesTable)
    .values(expenses)
    .returning();
  console.log(`     ✅ ${insertedExpenses.length} expenses created`);

  // 7. Audit logs
  console.log("  📋 Inserting audit logs...");
  await db.insert(auditLogsTable).values([
    { type: "sale", title: "Sale completed", detail: `${insertedOrders[0]!.orderNumber} was completed for ₹240.00` },
    { type: "sale", title: "Sale completed", detail: `${insertedOrders[1]!.orderNumber} was completed for ₹700.00` },
    { type: "product", title: "Product added", detail: "Whole Wheat Bread was added to the catalog" },
    { type: "customer", title: "Customer added", detail: "Raj Patel was added to customer records" },
    { type: "expense", title: "Expense recorded", detail: "Ingredients · ₹8500.00" },
  ]);
  console.log(`     ✅ 5 audit log entries created`);

  console.log("\n🎉  Seed completed successfully!");
  console.log("    Your BakeryBiz is ready to use.\n");
}

seed()
  .catch((err) => {
    console.error("❌  Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
