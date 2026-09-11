import { Router, type IRouter } from "express";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { db } from "@workspace/db";
import {
  auditLogsTable,
  categoriesTable,
  customersTable,
  expensesTable,
  inventoryTransactionsTable,
  orderItemsTable,
  ordersTable,
  productsTable,
  suppliersTable,
} from "@workspace/db";
import {
  CreateCustomerBody,
  CreateExpenseBody,
  CreateOrderBody,
  CreateProductBody,
  CreateSupplierBody,
  GetDashboardActivityResponse,
  GetDashboardSummaryResponse,
  GetOrderParams,
  GetOrderResponse,
  ListCategoriesResponse,
  ListCustomersQueryParams,
  ListCustomersResponse,
  ListExpensesResponse,
  ListInventoryItemsQueryParams,
  ListInventoryItemsResponse,
  ListOrdersQueryParams,
  ListOrdersResponse,
  ListProductsQueryParams,
  ListProductsResponse,
  ListSuppliersResponse,
  UpdateOrderStatusBody,
  UpdateOrderStatusParams,
  UpdateProductBody,
  UpdateProductParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const money = (value: number | string | null | undefined): number =>
  Number(value ?? 0);

async function getOrderRecord(id: number) {
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, id));
  if (!order) return undefined;
  const items = await db
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, id))
    .orderBy(asc(orderItemsTable.id));
  let customerName: string | null = null;
  if (order.customerId) {
    const [customer] = await db
      .select({ name: customersTable.name })
      .from(customersTable)
      .where(eq(customersTable.id, order.customerId));
    customerName = customer?.name ?? null;
  }
  return {
    ...order,
    subtotal: money(order.subtotal),
    discount: money(order.discount),
    tax: money(order.tax),
    total: money(order.total),
    customerName,
    items: items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      quantity: money(item.quantity),
      unitPrice: money(item.unitPrice),
      lineTotal: money(item.lineTotal),
    })),
  };
}

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [orderTotals] = await db
    .select({
      sales: sql<number>`coalesce(sum(${ordersTable.total}), 0)`,
      orders: sql<number>`count(*)`,
    })
    .from(ordersTable)
    .where(gte(ordersTable.createdAt, startOfDay));
  const [expenseTotals] = await db
    .select({ expenses: sql<number>`coalesce(sum(${expensesTable.amount}), 0)` })
    .from(expensesTable)
    .where(gte(expensesTable.createdAt, startOfDay));
  const [cashTotals] = await db
    .select({ value: sql<number>`coalesce(sum(${ordersTable.total}), 0)` })
    .from(ordersTable)
    .where(
      and(
        gte(ordersTable.createdAt, startOfDay),
        eq(ordersTable.paymentMethod, "cash"),
      ),
    );
  const [digitalTotals] = await db
    .select({ value: sql<number>`coalesce(sum(${ordersTable.total}), 0)` })
    .from(ordersTable)
    .where(
      and(
        gte(ordersTable.createdAt, startOfDay),
        or(
          eq(ordersTable.paymentMethod, "upi"),
          eq(ordersTable.paymentMethod, "card"),
          eq(ordersTable.paymentMethod, "bank_transfer"),
        ),
      ),
    );
  const [pendingTotals] = await db
    .select({ value: sql<number>`count(*)` })
    .from(ordersTable)
    .where(
      or(
        eq(ordersTable.status, "pending"),
        eq(ordersTable.status, "preparing"),
        eq(ordersTable.status, "ready"),
      ),
    );
  const [lowStockTotals] = await db
    .select({ value: sql<number>`count(*)` })
    .from(productsTable)
    .where(lte(productsTable.stock, productsTable.minStock));
  const recentOrders = await db
    .select()
    .from(ordersTable)
    .where(gte(ordersTable.createdAt, new Date(Date.now() - 7 * 86400000)))
    .orderBy(asc(ordersTable.createdAt));
  const salesTrend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    return {
      label: date.toLocaleDateString("en-IN", { weekday: "short" }),
      sales: recentOrders
        .filter((order) => order.createdAt >= date && order.createdAt < next)
        .reduce((sum, order) => sum + money(order.total), 0),
    };
  });
  const channelRows = await db
    .select({
      label: ordersTable.channel,
      value: sql<number>`coalesce(sum(${ordersTable.total}), 0)`,
    })
    .from(ordersTable)
    .where(gte(ordersTable.createdAt, startOfDay))
    .groupBy(ordersTable.channel);
  const topRows = await db
    .select({
      name: orderItemsTable.productName,
      units: sql<number>`coalesce(sum(${orderItemsTable.quantity}), 0)`,
      revenue: sql<number>`coalesce(sum(${orderItemsTable.lineTotal}), 0)`,
    })
    .from(orderItemsTable)
    .groupBy(orderItemsTable.productName)
    .orderBy(desc(sql`sum(${orderItemsTable.lineTotal})`))
    .limit(5);
  const result = {
    todaySales: money(orderTotals?.sales),
    todayExpenses: money(expenseTotals?.expenses),
    todayProfit: money(orderTotals?.sales) - money(expenseTotals?.expenses),
    todayOrders: Number(orderTotals?.orders ?? 0),
    offlineSales: money(
      channelRows.find((row) => row.label === "offline")?.value,
    ),
    onlineSales: channelRows
      .filter((row) => row.label !== "offline")
      .reduce((sum, row) => sum + money(row.value), 0),
    cashCollected: money(cashTotals?.value),
    digitalPayments: money(digitalTotals?.value),
    pendingOrders: Number(pendingTotals?.value ?? 0),
    lowStockItems: Number(lowStockTotals?.value ?? 0),
    salesTrend,
    channelBreakdown: channelRows.map((row) => ({
      label: row.label,
      value: money(row.value),
    })),
    topProducts: topRows.map((row) => ({
      name: row.name,
      units: money(row.units),
      revenue: money(row.revenue),
      margin: 0,
    })),
  };
  res.json(GetDashboardSummaryResponse.parse(result));
});

router.get("/dashboard/activity", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(auditLogsTable)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(10);
  res.json(
    GetDashboardActivityResponse.parse(
      rows.map((row) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        detail: row.detail,
        createdAt: row.createdAt,
      })),
    ),
  );
});

router.get("/categories", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: categoriesTable.id,
      name: categoriesTable.name,
      color: categoriesTable.color,
      productCount: sql<number>`count(${productsTable.id})`,
    })
    .from(categoriesTable)
    .leftJoin(productsTable, eq(productsTable.categoryId, categoriesTable.id))
    .groupBy(categoriesTable.id)
    .orderBy(asc(categoriesTable.name));
  res.json(
    ListCategoriesResponse.parse(
      rows.map((row) => ({ ...row, productCount: Number(row.productCount) })),
    ),
  );
});

router.get("/products", async (req, res): Promise<void> => {
  const parsed = ListProductsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { search, categoryId, status } = parsed.data;
  const conditions = [];
  if (search) {
    conditions.push(
      or(
        ilike(productsTable.name, `%${search}%`),
        ilike(productsTable.sku, `%${search}%`),
      ),
    );
  }
  if (categoryId) conditions.push(eq(productsTable.categoryId, categoryId));
  if (status) conditions.push(eq(productsTable.active, status === "active"));
  const rows = await db
    .select({
      product: productsTable,
      categoryName: categoriesTable.name,
    })
    .from(productsTable)
    .innerJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(productsTable.name));
  res.json(
    ListProductsResponse.parse(
      rows.map(({ product, categoryName }) => ({
        ...product,
        categoryName,
        description: product.description,
        price: money(product.price),
        cost: money(product.cost),
        stock: money(product.stock),
        minStock: money(product.minStock),
      })),
    ),
  );
});

router.post("/products", async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [product] = await db
    .insert(productsTable)
    .values(parsed.data)
    .returning();
  if (!product) {
    res.status(500).json({ error: "Product could not be created" });
    return;
  }
  await db.insert(auditLogsTable).values({
    type: "product",
    title: "Product added",
    detail: `${product.name} was added to the catalog`,
  });
  const [category] = await db
    .select({ name: categoriesTable.name })
    .from(categoriesTable)
    .where(eq(categoriesTable.id, product.categoryId));
  res.status(201).json(
    ListProductsResponse.parse([
      {
        ...product,
        categoryName: category?.name ?? "Uncategorized",
        price: money(product.price),
        cost: money(product.cost),
        stock: money(product.stock),
        minStock: money(product.minStock),
      },
    ])[0],
  );
});

router.patch("/products/:id", async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  const body = UpdateProductBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [product] = await db
    .update(productsTable)
    .set({ ...body.data, updatedAt: new Date() })
    .where(eq(productsTable.id, params.data.id))
    .returning();
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  const [category] = await db
    .select({ name: categoriesTable.name })
    .from(categoriesTable)
    .where(eq(categoriesTable.id, product.categoryId));
  res.json(
    ListProductsResponse.parse([
      {
        ...product,
        categoryName: category?.name ?? "Uncategorized",
        price: money(product.price),
        cost: money(product.cost),
        stock: money(product.stock),
        minStock: money(product.minStock),
      },
    ])[0],
  );
});

router.get("/inventory/summary", async (_req, res): Promise<void> => {
  const [row] = await db
    .select({
      totalItems: sql<number>`count(*)`,
      lowStockItems: sql<number>`count(*) filter (where ${productsTable.stock} <= ${productsTable.minStock})`,
      outOfStockItems: sql<number>`count(*) filter (where ${productsTable.stock} <= 0)`,
      inventoryValue: sql<number>`coalesce(sum(${productsTable.stock} * ${productsTable.cost}), 0)`,
    })
    .from(productsTable)
    .where(eq(productsTable.active, true));
  res.json({
    totalItems: Number(row?.totalItems ?? 0),
    lowStockItems: Number(row?.lowStockItems ?? 0),
    outOfStockItems: Number(row?.outOfStockItems ?? 0),
    inventoryValue: money(row?.inventoryValue),
  });
});

router.get("/inventory/items", async (req, res): Promise<void> => {
  const parsed = ListInventoryItemsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { search, lowStock } = parsed.data;
  const conditions = [eq(productsTable.active, true)];
  if (search) {
    conditions.push(
      or(
        ilike(productsTable.name, `%${search}%`),
        ilike(productsTable.sku, `%${search}%`),
      ) as typeof conditions[number],
    );
  }
  if (lowStock) {
    conditions.push(lte(productsTable.stock, productsTable.minStock));
  }
  const rows = await db
    .select({ product: productsTable, categoryName: categoriesTable.name })
    .from(productsTable)
    .innerJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(and(...conditions))
    .orderBy(asc(productsTable.stock));
  res.json(
    ListInventoryItemsResponse.parse(
      rows.map(({ product, categoryName }) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        categoryName,
        stock: money(product.stock),
        minStock: money(product.minStock),
        unit: product.unit,
        status: product.stock <= 0 ? "out" : product.stock <= product.minStock ? "low" : "healthy",
        value: money(product.stock) * money(product.cost),
      })),
    ),
  );
});

router.get("/orders", async (req, res): Promise<void> => {
  const parsed = ListOrdersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const conditions = [];
  if (parsed.data.search) {
    conditions.push(ilike(ordersTable.orderNumber, `%${parsed.data.search}%`));
  }
  if (parsed.data.status) conditions.push(eq(ordersTable.status, parsed.data.status));
  const rows = await db
    .select()
    .from(ordersTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(ordersTable.createdAt))
    .limit(100);
  const orders = await Promise.all(rows.map((row) => getOrderRecord(row.id)));
  res.json(ListOrdersResponse.parse(orders.filter(Boolean)));
});

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const orderId = await db.transaction(async (tx) => {
      const productRows = await Promise.all(
        parsed.data.items.map((item) =>
          tx
            .select()
            .from(productsTable)
            .where(eq(productsTable.id, item.productId)),
        ),
      );
      const products = productRows.map((rows) => rows[0]);
      if (products.some((product, index) => !product || money(product.stock) < parsed.data.items[index].quantity)) {
        throw new Error("One or more products do not have enough stock");
      }
      const subtotal = parsed.data.items.reduce(
        (sum, item, index) => sum + item.quantity * money(products[index]?.price),
        0,
      );
      const discount = parsed.data.discount ?? 0;
      const tax = parsed.data.tax ?? 0;
      const total = Math.max(0, subtotal - discount + tax);
      const [order] = await tx
        .insert(ordersTable)
        .values({
          orderNumber: `ORD-${Date.now()}`,
          status: "completed",
          channel: parsed.data.channel ?? "offline",
          paymentMethod: parsed.data.paymentMethod,
          customerId: parsed.data.customerId,
          subtotal,
          discount,
          tax,
          total,
        })
        .returning();
      if (!order) throw new Error("Order could not be created");
      await tx.insert(orderItemsTable).values(
        parsed.data.items.map((item, index) => ({
          orderId: order.id,
          productId: item.productId,
          productName: products[index]?.name ?? "Product",
          quantity: item.quantity,
          unitPrice: money(products[index]?.price),
          lineTotal: item.quantity * money(products[index]?.price),
        })),
      );
      for (const item of parsed.data.items) {
        await tx
          .update(productsTable)
          .set({ stock: sql`${productsTable.stock} - ${item.quantity}`, updatedAt: new Date() })
          .where(eq(productsTable.id, item.productId));
        await tx.insert(inventoryTransactionsTable).values({
          productId: item.productId,
          type: "SALE",
          quantity: -item.quantity,
          note: order.orderNumber,
        });
      }
      await tx.insert(auditLogsTable).values({
        type: "sale",
        title: "Sale completed",
        detail: `${order.orderNumber} was completed for ₹${total.toFixed(2)}`,
      });
      return order.id;
    });
    const order = await getOrderRecord(orderId);
    if (!order) {
      res.status(500).json({ error: "Order could not be read after creation" });
      return;
    }
    res.status(201).json(GetOrderResponse.parse(order));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Order could not be completed" });
  }
});

router.get("/orders/:id", async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const order = await getOrderRecord(params.data.id);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json(GetOrderResponse.parse(order));
});

router.patch("/orders/:id", async (req, res): Promise<void> => {
  const params = UpdateOrderStatusParams.safeParse(req.params);
  const body = UpdateOrderStatusBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [updated] = await db
    .update(ordersTable)
    .set({ status: body.data.status })
    .where(eq(ordersTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  const order = await getOrderRecord(updated.id);
  res.json(GetOrderResponse.parse(order));
});

router.get("/expenses", async (_req, res): Promise<void> => {
  const rows = await db.select().from(expensesTable).orderBy(desc(expensesTable.expenseDate), desc(expensesTable.id)).limit(100);
  res.json(
    ListExpensesResponse.parse(
      rows.map((row) => ({ ...row, amount: money(row.amount), vendor: row.vendor })),
    ),
  );
});

router.post("/expenses", async (req, res): Promise<void> => {
  const parsed = CreateExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [expense] = await db
    .insert(expensesTable)
    .values({
      ...parsed.data,
      expenseDate:
        parsed.data.expenseDate instanceof Date
          ? parsed.data.expenseDate.toISOString().slice(0, 10)
          : parsed.data.expenseDate,
    })
    .returning();
  if (!expense) {
    res.status(500).json({ error: "Expense could not be created" });
    return;
  }
  await db.insert(auditLogsTable).values({
    type: "expense",
    title: "Expense recorded",
    detail: `${expense.category} · ₹${money(expense.amount).toFixed(2)}`,
  });
  res.status(201).json({ ...expense, amount: money(expense.amount) });
});

router.get("/customers", async (req, res): Promise<void> => {
  const parsed = ListCustomersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const rows = await db.select().from(customersTable).where(
    parsed.data.search
      ? or(ilike(customersTable.name, `%${parsed.data.search}%`), ilike(customersTable.phone, `%${parsed.data.search}%`))
      : undefined,
  ).orderBy(asc(customersTable.name));
  const counts = await db
    .select({
      customerId: ordersTable.customerId,
      totalOrders: sql<number>`count(*)`,
      totalSpent: sql<number>`coalesce(sum(${ordersTable.total}), 0)`,
    })
    .from(ordersTable)
    .groupBy(ordersTable.customerId);
  res.json(
    ListCustomersResponse.parse(
      rows.map((row) => {
        const count = counts.find((item) => item.customerId === row.id);
        return {
          ...row,
          totalOrders: Number(count?.totalOrders ?? 0),
          totalSpent: money(count?.totalSpent),
          outstandingCredit: money(row.outstandingCredit),
        };
      }),
    ),
  );
});

router.post("/customers", async (req, res): Promise<void> => {
  const parsed = CreateCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [customer] = await db.insert(customersTable).values(parsed.data).returning();
  if (!customer) {
    res.status(500).json({ error: "Customer could not be created" });
    return;
  }
  await db.insert(auditLogsTable).values({
    type: "customer",
    title: "Customer added",
    detail: `${customer.name} was added to customer records`,
  });
  res.status(201).json({
    ...customer,
    totalOrders: 0,
    totalSpent: 0,
    outstandingCredit: money(customer.outstandingCredit),
  });
});

router.get("/suppliers", async (_req, res): Promise<void> => {
  const rows = await db.select().from(suppliersTable).orderBy(asc(suppliersTable.name));
  res.json(
    ListSuppliersResponse.parse(
      rows.map((row) => ({
        ...row,
        totalPurchases: money(row.totalPurchases),
        outstanding: money(row.outstanding),
      })),
    ),
  );
});

router.post("/suppliers", async (req, res): Promise<void> => {
  const parsed = CreateSupplierBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [supplier] = await db.insert(suppliersTable).values(parsed.data).returning();
  if (!supplier) {
    res.status(500).json({ error: "Supplier could not be created" });
    return;
  }
  await db.insert(auditLogsTable).values({
    type: "supplier",
    title: "Supplier added",
    detail: `${supplier.name} was added to supplier records`,
  });
  res.status(201).json({
    ...supplier,
    totalPurchases: money(supplier.totalPurchases),
    outstanding: money(supplier.outstanding),
  });
});

export default router;