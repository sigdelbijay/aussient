"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/dal";
import { setMarketingConsent } from "@/lib/marketing";
import type { FormState } from "@/lib/auth/actions";

// Every action re-checks the signed-in user and only touches *their* rows.

export async function updateDetailsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const name = z.string().trim().min(1, "Enter your name").max(100).safeParse(formData.get("name"));
  if (!name.success) return { error: name.error.issues[0].message };
  await prisma.user.update({ where: { id: user.id }, data: { name: name.data } });
  revalidatePath("/account");
  return { message: "Details saved." };
}

/** The "email me news and offers" switch. */
export async function updateMarketingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const yes = formData.get("marketing") === "on";
  await setMarketingConsent(user.email, yes);
  revalidatePath("/account");
  return { message: yes ? "You're subscribed to news and offers." : "You won't get marketing emails from us. Order emails still come as usual." };
}

const passwordSchema = z
  .object({
    current: z.string().optional(),
    password: z.string().min(8, "New password must be at least 8 characters").max(72),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "New passwords don't match" });

export async function changePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Google-only accounts have no password yet, so they can set one directly.
  if (user.passwordHash && !(await bcrypt.compare(parsed.data.current ?? "", user.passwordHash))) {
    return { error: "Your current password is incorrect." };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      sessionVersion: { increment: 1 }, // signs out other devices
    },
  });
  await signOut({ redirectTo: "/login?changed=1" });
  return undefined;
}

const addressSchema = z.object({
  label: z.string().trim().max(40).optional(),
  fullName: z.string().trim().min(1, "Enter the recipient's name").max(100),
  line1: z.string().trim().min(1, "Enter the street address").max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1, "Enter the suburb or city").max(100),
  state: z.enum(["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"], "Choose a state"),
  postcode: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Postcode must be 4 digits"),
  phone: z.string().trim().max(30).optional(),
});

export async function addAddressAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = addressSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const isFirst = (await prisma.address.count({ where: { userId: user.id } })) === 0;
  await prisma.address.create({
    data: {
      ...parsed.data,
      label: parsed.data.label || null,
      line2: parsed.data.line2 || null,
      phone: parsed.data.phone || null,
      userId: user.id,
      isDefault: isFirst,
    },
  });
  revalidatePath("/account");
  return { message: "Address saved." };
}

export async function deleteAddressAction(formData: FormData) {
  const user = await requireUser();
  await prisma.address.deleteMany({ where: { id: String(formData.get("id")), userId: user.id } });
  revalidatePath("/account");
}

export async function setDefaultAddressAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  await prisma.$transaction([
    prisma.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } }),
    prisma.address.updateMany({ where: { id, userId: user.id }, data: { isDefault: true } }),
  ]);
  revalidatePath("/account");
}

export async function removeFromWishlistAction(formData: FormData) {
  const user = await requireUser();
  await prisma.wishlist.deleteMany({
    where: { userId: user.id, productId: String(formData.get("productId")) },
  });
  revalidatePath("/account");
}
