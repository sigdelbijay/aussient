import { expect, test, type Page } from "@playwright/test";
import { dbTask, totpCode, waitForEmail } from "./helpers.mts";

/**
 * The whole shopping trip: sign up → confirm email → add a product to the bag
 * → pay on Stripe's test page with the 4242 test card → see the order in admin.
 */

const shopper = {
  name: "Test Shopper",
  email: `e2e-shopper-${Date.now()}@example.test`,
  password: "a-strong-test-password",
};
let admin: { email: string; password: string; secret: string };

test.beforeAll(() => {
  admin = dbTask("create-admin");
});

test.afterAll(() => {
  dbTask("clean-up", shopper.email, admin.email);
});

test("sign up, buy with the Stripe test card, and see the order in admin", async ({ page }) => {
  // 1. Sign up, and confirm the email with the link from the outbox.
  await page.goto("/signup");
  await page.locator("input[name=name]").fill(shopper.name);
  await page.locator("main input[name=email]").fill(shopper.email);
  await page.locator("input[name=password]").fill(shopper.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("We've sent a confirmation link")).toBeVisible();

  const email = await waitForEmail(shopper.email, /confirm/i);
  const link = email.match(/href="([^"]*\/verify-email\?token=[^"]+)"/)?.[1];
  expect(link, "confirmation link in the email").toBeTruthy();
  await page.goto(link!.replace(/&amp;/g, "&"));

  await login(page, shopper.email, shopper.password);
  await expect(page).toHaveURL(/\/account/);

  // 2. Add an in-stock product to the bag.
  const variant = dbTask<{ id: string; slug: string; name: string }>("pick-variant");
  await page.goto(`/products/${variant.slug}?variant=${variant.id}`);
  await page.getByRole("button", { name: "Add to bag" }).click();
  const bag = page.getByRole("dialog");
  await expect(bag.getByText(variant.name)).toBeVisible();

  // 3. Checkout → Stripe's payment page (test mode) → pay with 4242 4242 4242 4242.
  await bag.getByRole("button", { name: "Checkout" }).click();
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
  await payOnStripe(page);

  // 4. Back on our thank-you page with an order number.
  await page.waitForURL(/\/checkout\/success/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Thank you!" })).toBeVisible();
  const number = (
    await page
      .getByText(/AUS-\d+/)
      .first()
      .textContent()
  )?.match(/AUS-\d+/)?.[0];
  expect(number).toBeTruthy();
  await waitForEmail(shopper.email, new RegExp(number!));

  // 5. Log in as the admin and find the order.
  await page.context().clearCookies();
  await login(page, admin.email, admin.password, admin.secret, "/admin/orders");
  await page.getByRole("searchbox").fill(number!);
  await page.getByRole("searchbox").press("Enter");
  await page.getByRole("link", { name: number! }).first().click();
  await expect(page.getByRole("heading", { name: new RegExp(number!) })).toBeVisible();
  await expect(page.getByText(shopper.email).first()).toBeVisible();
  await expect(page.getByText(variant.name).first()).toBeVisible();
  await expect(page.getByText("To ship").first()).toBeVisible();
});

async function login(
  page: Page,
  email: string,
  password: string,
  totpSecret?: string,
  to = "/account",
) {
  await page.goto(`/login?callbackUrl=${encodeURIComponent(to)}`);
  await page.locator("main input[name=email]").fill(email);
  await page.locator("input[name=password]").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  if (totpSecret) {
    await page.getByLabel(/6-digit code/).fill(totpCode(totpSecret));
    await page.getByRole("button", { name: "Verify and log in" }).click();
  }
  await page.waitForURL((url) => url.pathname.startsWith(to));
}

/** Fills in Stripe's hosted payment page with test details. */
async function payOnStripe(page: Page) {
  await page.locator("#shippingName").fill(shopper.name);
  await page.locator("#shippingAddressLine1").fill("1 Test Street");
  // Stripe suggests addresses as you type; close the list so it doesn't cover the fields.
  await page.keyboard.press("Escape");
  await page.locator("#shippingLocality").fill("Sydney");
  await page.locator("#shippingAdministrativeArea").selectOption("NSW");
  await page.locator("#shippingPostalCode").fill("2000");
  const phone = page.locator("#phoneNumber");
  if (await phone.isVisible()) await phone.fill("0412 345 678");

  // With other ways to pay switched on (Zip, Klarna…), card is one of several choices.
  const cardChoice = page.getByTestId("card-accordion-item");
  await cardChoice.or(page.locator("#cardNumber")).filter({ visible: true }).first().waitFor();
  if (!(await page.locator("#cardNumber").isVisible())) await cardChoice.click();

  await page.locator("#cardNumber").fill("4242 4242 4242 4242");
  await page.locator("#cardExpiry").fill("12 / 34");
  await page.locator("#cardCvc").fill("123");
  const billingName = page.locator("#billingName");
  if (await billingName.isVisible()) await billingName.fill(shopper.name);

  // "Save my info" (Stripe Link) would ask for more details — leave it off.
  const saveInfo = page.locator("#enableStripePass");
  if (await saveInfo.isChecked().catch(() => false)) await saveInfo.uncheck();

  await page.getByTestId("hosted-payment-submit-button").click();
}
