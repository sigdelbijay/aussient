/**
 * The emails customers (and new staff) get. The admin can change each one's
 * subject and opening text under Site Content → Emails; these are the
 * defaults until they do. Words in {braces} are filled in when it's sent.
 */

export type EmailKey = "verify-email" | "password-reset" | "staff-invite" | "order-confirmation" | "order-shipped" | "back-in-stock";

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
  "order-shipped": {
    name: "Order shipped",
    when: "An order is marked as shipped",
    live: false,
    subject: "Your {store} order {order} is on its way",
    body: "Hi {name}, good news — your order has shipped. Tap below to track it.",
    placeholders: ["store", "name", "order"],
  },
  "back-in-stock": {
    name: "Back in stock",
    when: "Something a customer asked about is back in stock",
    live: false,
    subject: "{product} is back in stock",
    body: "Good news — {product} is back. Stock is limited, so grab it while you can.",
    placeholders: ["store", "product"],
  },
};

export const isEmailKey = (key: string): key is EmailKey => key in EMAIL_TEMPLATES;

/** Replaces {word} with its value; unknown {words} are left as they are. */
export function fillPlaceholders(text: string, values: Record<string, string>) {
  return text.replace(/\{(\w+)\}/g, (whole, word: string) => values[word] ?? whole);
}
