import { expect, test } from "@playwright/test";
import path from "node:path";

test("imports into the contextual workspace, prices one product, and authorizes images", async ({ page }) => {
  await page.goto("/spreadsheet-agent");
  await page.locator('input[type="file"][accept=".xlsx,.xls,.csv"]').setInputFiles(path.join(process.cwd(), "e2e/fixtures/products.csv"));
  await expect(page.getByText(/原始数据预览|Source data preview/)).toBeVisible();
  await expect(page.getByText(/商品工作台|Product workspace/)).toBeVisible();
  await expect(page.getByText("LAMP-001")).toBeVisible();
  await expect(page.getByRole("heading", { name: /工作台设置|Workspace settings/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /财务概览|Financial overview/ })).toBeVisible();
  await expect(page.getByText(/批量定价|Batch pricing/)).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: /切换工作台模板|Switch workspace template/ }).locator("option")).toHaveCount(1);
  await page.getByText("LAMP-001", { exact: true }).last().click();
  await expect(page.getByRole("heading", { name: /商品属性|Product properties/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /售价计算|Price calculation/ })).toBeVisible();
  await page.getByRole("button", { name: /重新计算当前商品|Recalculate product/ }).click();
  await expect(page.getByText(/已更新 1 件商品的售价|Updated prices for 1 product/)).toBeVisible();
  await page.getByRole("button", { name: /工作台|Workspace/, exact: true }).click();
  await expect(page.getByRole("heading", { name: /模板映射|Template mapping/ })).toHaveCount(0);
  await expect(page.locator('[role="dialog"]')).toHaveCount(0);
  await page.getByRole("button", { name: /点击加载商品图片|Click to load product image/ }).first().click();
  await expect(page.getByText(/加载外部商品图片|Load external product images/)).toBeVisible();
  await page.getByRole("button", { name: /允许本次会话|Allow this session/ }).click();
  await expect(page.getByRole("button", { name: /Excel/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /CSV/ })).toBeVisible();
});

test("maps 1688 selection pool exports into AliExpress product fields", async ({ page }) => {
  await page.goto("/spreadsheet-agent");
  await page.locator('input[type="file"][accept=".xlsx,.xls,.csv"]').setInputFiles(path.join(process.cwd(), "e2e/fixtures/selection-pool.csv"));
  await expect(page.getByText("1016465348058")).toBeVisible();
  await expect(page.getByText("高级感无领西装套裙女时尚都市收腰系带咖色套装气质职业装通勤风")).toBeVisible();
  await page.getByText("1016465348058", { exact: true }).last().click();
  await expect(page.getByRole("heading", { name: /商品属性|Product properties/ })).toBeVisible();
  await expect(page.getByLabel("Seller SKU")).toHaveValue("1016465348058");
  await expect(page.getByLabel("Cost")).toHaveValue("158");
  await page.getByText(/商品信息|Product information/).click();
  await expect(page.getByLabel("Category")).toHaveValue("默认");
  await expect(page.getByLabel("Retail Price")).toHaveValue("");
  await expect(page.getByText(/字段问题|field issues/)).toBeVisible();
  await page.getByRole("button", { name: /重新计算当前商品|Recalculate product/ }).click();
  await expect(page.getByText(/已更新 1 件商品的售价|Updated prices for 1 product/)).toBeVisible();
  await expect(page.getByLabel("Retail Price")).not.toHaveValue("");
});
