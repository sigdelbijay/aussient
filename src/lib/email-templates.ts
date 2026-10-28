/**
 * The emails customers (and new staff) get. The admin can change each one's
 * subject and opening text under Site Content → Emails; these are the
 * defaults until they do. Words in {braces} are filled in when it's sent.
 */

export type EmailKey =
  | "verify-email"
  | "welcome"
  | "password-reset"
  | "staff-invite"
  | "order-confirmation"
  | "new-order-admin"
  | "order-shipped"
  | "order-cancelled"
  | "refund-confirmation"
  | "back-in-stock"
  | "bag-reminder";

export type EmailTemplateInfo = {
  name: string;
  /** When it's sent, in plain words. */
  when: string;
  /** False for emails whose part of the shop isn't built yet (they'll use this text once it is). */
  live: boolean;
  subject: string;
  body: string;
  /** The {words} this email can use. */
  placeholders: string[];
};

export const EMAIL_TEMPLATES: Record<EmailKey, EmailTemplateInfo> = {
  "verify-email": {
    name: "Confirm email",
    when: "Someone creates an account",
    live: true,
    subject: "Confirm your {store} account",
    body: "Thanks for joining {store}! Tap below to confirm your email address. This link expires in 24 hours.",
    placeholders: ["store"],
  },
  welcome: {
    name: "Welcome",
    when: "Someone confirms their email, or signs up with Google",
    live: true,
    subject: "Welcome to {store}",
    body: "Hi {name}, welcome to {store}! Your account is ready — save favourites to your wishlist, keep your addresses handy and track every order in one place.",
    placeholders: ["store", "name"],
  },
  "password-reset": {
    name: "Reset password",
    when: "Someone asks to reset their password",
    live: true,
    subject: "Reset your {store} password",
    body: "Tap below to choose a new password. This link expires in 30 minutes and can only be used once.",
    placeholders: ["store"],
  },
  "staff-invite": {
    name: "Staff invite",
    when: "An admin invites someone to help run the shop",
    live: true,
    subject: "You're invited to help run {store}",
    body: "{inviter} has added you to the {store} admin as {role}. Tap below to choose a password — you'll then set up an authenticator app to keep the account safe. This link expires in 7 days.",
    placeholders: ["store", "inviter", "role"],
  },
  "order-confirmation": {
    name: "Order confirmation",
    when: "A customer pays for an order",
    live: false,
    subject: "Thanks for your order {order}",
    body: "Hi {name}, thanks for shopping with {store}! We've got your order and will let you know when it ships.",
    placeholders: ["store", "name", "order"],
  },
  "new-order-admin": {
    name: "New order (to you)",
    when: "A customer pays for an order — sent to the shop, not the customer",
    live: false,
    subject: "New order {order} — {total}",
    body: "{name} ({email}) just placed an order for {total}.",
    placeholders: ["store", "order", "name", "email", "total"],
  },
  "order-shipped": {
    name: "Order shipped",
    when: "An order is marked as shipped",
    live: true,
    subject: "Your {store} order {order} is on its way",
    body: "Hi {name}, good news — your order has shipped. Your tracking number is {tracking}.",
    placeholders: ["store", "name", "order", "tracking"],
  },
  "order-cancelled": {
    name: "Order cancelled",
    when: "An order is cancelled",
    live: true,
    subject: "Your {store} order {order} has been cancelled",
    body: "Hi {name}, we've cancelled your order {order} and refunded {amount} to the card you paid with. It can take 5–10 business days to show up.",
    placeholders: ["store", "name", "order", "amount"],
  },
  "refund-confirmation": {
    name: "Refund confirmation",
    when: "An order is refunded",
    live: true,
    subject: "Your refund for order {order}",
    body: "Hi {name}, we've refunded {amount} for order {order} to the card you paid with. It can take 5–10 business days to show up.",
    placeholders: ["store", "name", "order", "amount"],
  },
  "back-in-stock": {
    name: "Back in stock",
    when: "Something a customer clicked “Notify me” on is back in stock",
    live: true,
    subject: "{product} is back in stock",
    body: "Good news — {product} is back. Stock is limited, so grab it while you can.",
    placeholders: ["store", "product"],
  },
  "bag-reminder": {
    name: "Left in your bag",
    when: "A signed-in customer who agreed to marketing emails leaves items in their bag for 2 hours",
    live: true,
    subject: "You left something in your bag",
    body: "Hi {name}, the things you picked out at {store} are still in your bag — but stock can run out. Tap below to pick up where you left off.",
    placeholders: ["store", "name"],
  },
};

export const isEmailKey = (key: string): key is EmailKey => key in EMAIL_TEMPLATES;

/** Replaces {word} with its value; unknown {words} are left as they are. */
export function fillPlaceholders(text: string, values: Record<string, string>) {
  return text.replace(/\{(\w+)\}/g, (whole, word: string) => values[word] ?? whole);
}
