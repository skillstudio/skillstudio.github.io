import { expect, test } from "@playwright/test";

const routes = ["/compress", "/pdf-to-image", "/image-resize", "/image-converter", "/image-crop", "/image-watermark"];
const directRoutes = routes.flatMap((route) => [route, `${route}/`]);

test("home exposes every live tool", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  for (const route of routes) await expect(page.locator(`a[href="${route}"]`)).toBeVisible();
});

for (const route of directRoutes) {
  test(`${route} loads directly`, async ({ page }) => {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/never uploaded|绝不会上传/)).toBeVisible();
  });
}
