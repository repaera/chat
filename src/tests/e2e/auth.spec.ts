import { test, expect, type Page } from "@playwright/test";

// A unique email per run so the beforeAll account never conflicts on re-runs.
const USER = {
  name: "E2E Tester",
  email: `e2e-auth-${Date.now()}@test.example`,
  password: "E2eTest123!",
};

async function register(page: Page, name: string, email: string, password: string) {
  await page.goto("/register");
  await page.getByPlaceholder("John Doe").fill(name);
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("At least 8 characters").fill(password);
  await page.getByPlaceholder("Repeat your password").fill(password);
  await page.getByRole("button", { name: "Create Account" }).click();
}

// Tests that share the USER account must run in order.
test.describe.serial("Auth flow", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await register(page, USER.name, USER.email, USER.password);
    await page.waitForURL("/");
    await page.close();
  });

  test("unauthenticated / redirects to /login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated /chat/[id] redirects to /login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/chat/01952b4e-2a1f-7b3c-9d4e-5f6a7b8c9d0e");
    await expect(page).toHaveURL(/\/login/);
  });

  test("register a new account and redirect to /", async ({ page }) => {
    const email = `e2e-register-${Date.now()}@test.example`;
    await register(page, "New User", email, "NewUser123!");
    await expect(page).toHaveURL("/");
  });

  test("login with valid credentials redirects to /", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("you@email.com").fill(USER.email);
    await page.getByPlaceholder("••••••••").fill(USER.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");
  });

  test("sign out redirects to /login", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.getByPlaceholder("you@email.com").fill(USER.email);
    await page.getByPlaceholder("••••••••").fill(USER.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("/");

    // Open the sidebar, then open the user dropdown and sign out
    await page.locator("[data-sidebar='trigger']").click();
    await page.locator("[data-sidebar='footer'] button").click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
