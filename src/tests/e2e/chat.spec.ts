import { expect, type Page, test } from "@playwright/test";

const USER = {
	name: "Chat Tester",
	email: `e2e-chat-${Date.now()}@test.example`,
	password: "ChatTest123!",
};

async function loginAs(
	page: Page,
	email = USER.email,
	password = USER.password,
) {
	await page.goto("/login");
	await page.getByPlaceholder("you@email.com").fill(email);
	await page.getByPlaceholder("••••••••").fill(password);
	await page.getByRole("button", { name: "Sign in" }).click();
	await page.waitForURL("/");
}

async function openSidebar(page: Page) {
	await page.locator("[data-sidebar='trigger']").click();
}

test.describe
	.serial("Chat flow", () => {
		test.beforeAll(async ({ browser }) => {
			const page = await browser.newPage();
			await page.goto("/register");
			await page.getByPlaceholder("John Doe").fill(USER.name);
			await page.getByPlaceholder("you@email.com").fill(USER.email);
			await page.getByPlaceholder("At least 8 characters").fill(USER.password);
			await page.getByPlaceholder("Repeat your password").fill(USER.password);
			await page.getByRole("button", { name: "Create Account" }).click();
			await page.waitForURL("/");
			await page.close();
		});

		test("send a message and receive a response", async ({ page }) => {
			await loginAs(page);
			await page.getByPlaceholder(/type a message/i).fill("Hello");
			await page.locator("button[type='submit']").click();
			// URL changes to /chat/[id] once the conversation is created
			await expect(page).toHaveURL(/\/chat\/.+/);
			// User's message bubble is visible
			await expect(page.getByText("Hello")).toBeVisible();
		});

		test("new conversation appears in the sidebar", async ({ page }) => {
			await loginAs(page);
			await page
				.getByPlaceholder(/type a message/i)
				.fill("Tell me something interesting");
			await page.locator("button[type='submit']").click();
			await expect(page).toHaveURL(/\/chat\/.+/);

			await openSidebar(page);
			await expect(page.locator("aside")).toContainText(
				/tell me|conversation/i,
			);
		});

		test("delete a conversation returns to /", async ({ page }) => {
			await loginAs(page);

			// Create a conversation first
			await page
				.getByPlaceholder(/type a message/i)
				.fill("Test delete conversation");
			await page.locator("button[type='submit']").click();
			await expect(page).toHaveURL(/\/chat\/.+/);

			// Open sidebar, hover the first conversation item to reveal ✕, then confirm delete
			await openSidebar(page);
			const convItem = page.locator("aside li").first();
			await convItem.hover();
			await convItem.locator("button[data-sidebar='menu-action']").click();
			await page.getByRole("button", { name: "Delete" }).click();

			await expect(page).toHaveURL("/");
		});
	});
