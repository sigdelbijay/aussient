import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LogOut, ShieldCheck, Trash2 } from "lucide-react";
import { isStaffRole } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/dal";
import { logoutAction } from "@/lib/auth/actions";
import { formatPrice } from "@/lib/format";
import { pricing } from "@/lib/storefront";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ActionForm } from "@/components/auth/action-form";
import { Field } from "@/components/auth/form-bits";
import {
  addAddressAction,
  changePasswordAction,
  deleteAddressAction,
  removeFromWishlistAction,
  setDefaultAddressAction,
  updateDetailsAction,
  updateMarketingAction,
} from "./actions";

export const metadata: Metadata = { title: "My account" };

const STATES = ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"];
const dateFmt = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function AccountPage() {
  const user = await requireUser("/account");

  const [orders, addresses, wishlist] = await Promise.all([
    prisma.order.findMany({
      where: { OR: [{ userId: user.id }, { email: user.email }] },
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.address.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    }),
    prisma.wishlist.findMany({
      where: { userId: user.id },
      include: {
        product: {
          include: {
            media: { orderBy: { order: "asc" }, take: 1 },
            variants: { select: { price: true, salePrice: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">My account</p>
          <h1 className="text-display text-3xl sm:text-4xl">Hi, {user.name ?? "there"}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {isStaffRole(user.role) && (
            <>
              <Link
                href="/account/security"
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                <ShieldCheck /> Two-factor
              </Link>
              <Link href="/admin" className={buttonVariants({ size: "lg" })}>
                Admin
              </Link>
            </>
          )}
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="lg">
              <LogOut /> Log out
            </Button>
          </form>
        </div>
      </header>

      <div className="grid gap-12">
        {/* Orders */}
        <Section title="My orders">
          {orders.length === 0 ? (
            <Empty>
              No orders yet.{" "}
              <Link href="/" className="font-semibold text-foreground hover:underline">
                Start shopping
              </Link>
            </Empty>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[32rem] text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Items</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td className="px-4 py-3 font-semibold">{o.number}</td>
                      <td className="px-4 py-3">{dateFmt.format(o.createdAt)}</td>
                      <td className="px-4 py-3">{o._count.items}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{o.status.toLowerCase()}</Badge>
                        {o.trackingNumber && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            Tracking: {o.trackingNumber}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatPrice(Number(o.total))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Details + password */}
        <div className="grid gap-12 md:grid-cols-2">
          <Section title="My details">
            <ActionForm action={updateDetailsAction} submitLabel="Save details" keepOnSuccess>
              <Field
                label="Name"
                name="name"
                defaultValue={user.name ?? ""}
                required
                maxLength={100}
              />
              <Field
                label="Email"
                value={user.email}
                disabled
                readOnly
                hint="Contact us to change your email."
              />
            </ActionForm>
          </Section>

          <Section title={user.passwordHash ? "Change password" : "Set a password"}>
            <ActionForm action={changePasswordAction} submitLabel="Update password" keepOnSuccess>
              {user.passwordHash && (
                <Field
                  label="Current password"
                  name="current"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              )}
              <Field
                label="New password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={72}
              />
              <Field
                label="Confirm new password"
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
              />
            </ActionForm>
          </Section>
        </div>

        {/* Marketing consent */}
        <Section title="Emails from us">
          <ActionForm action={updateMarketingAction} submitLabel="Save" keepOnSuccess>
            <label className="flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                name="marketing"
                defaultChecked={user.marketingOptIn}
                className="mt-0.5 size-4 shrink-0 accent-foreground"
              />
              <span>
                Email me news, offers and a reminder if I leave something in my bag.
                <span className="block text-xs text-muted-foreground">
                  Order confirmations and shipping updates always come, whatever you choose.
                </span>
              </span>
            </label>
          </ActionForm>
        </Section>

        {/* Addresses */}
        <Section title="Saved addresses">
          <div className="grid gap-4 sm:grid-cols-2">
            {addresses.map((a) => (
              <div key={a.id} className="rounded-lg border border-border p-4 text-sm">
                <div className="mb-2 flex items-center gap-2">
                  <p className="font-semibold">{a.label ?? a.fullName}</p>
                  {a.isDefault && <Badge>Default</Badge>}
                </div>
                <p>{a.fullName}</p>
                <p>{a.line1}</p>
                {a.line2 && <p>{a.line2}</p>}
                <p>
                  {a.city} {a.state} {a.postcode}
                </p>
                {a.phone && <p className="text-muted-foreground">{a.phone}</p>}
                <div className="mt-3 flex gap-2">
                  {!a.isDefault && (
                    <form action={setDefaultAddressAction}>
                      <input type="hidden" name="id" value={a.id} />
                      <Button type="submit" variant="outline" size="sm">
                        Make default
                      </Button>
                    </form>
                  )}
                  <form action={deleteAddressAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <Button type="submit" variant="destructive" size="sm">
                      <Trash2 /> Remove
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </div>

          <details className="mt-4 rounded-lg border border-dashed border-border p-4 open:border-solid">
            <summary className="cursor-pointer text-sm font-semibold">+ Add a new address</summary>
            <ActionForm
              action={addAddressAction}
              submitLabel="Save address"
              keepOnSuccess
              className="mt-4 grid gap-4 sm:grid-cols-2"
            >
              <Field
                label="Label (optional)"
                name="label"
                placeholder="Home, Work…"
                maxLength={40}
              />
              <Field label="Full name" name="fullName" autoComplete="name" required />
              <Field label="Street address" name="line1" autoComplete="address-line1" required />
              <Field label="Apartment, unit (optional)" name="line2" autoComplete="address-line2" />
              <Field label="Suburb / city" name="city" autoComplete="address-level2" required />
              <div className="grid grid-cols-2 gap-4">
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium">State</span>
                  <select
                    name="state"
                    required
                    defaultValue=""
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="" disabled>
                      Choose
                    </option>
                    {STATES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <Field
                  label="Postcode"
                  name="postcode"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  required
                />
              </div>
              <Field label="Phone (optional)" name="phone" type="tel" autoComplete="tel" />
            </ActionForm>
          </details>
        </Section>

        {/* Wishlist */}
        <Section title="My wishlist">
          {wishlist.length === 0 ? (
            <Empty>Tap the heart on any product to save it here.</Empty>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {wishlist.map(({ product }) => (
                <div key={product.id} className="grid gap-2">
                  <Link
                    href={`/products/${product.slug}`}
                    className="relative block aspect-[4/5] overflow-hidden rounded-lg bg-muted"
                  >
                    {product.media[0] && (
                      <Image
                        src={product.media[0].url}
                        alt={product.media[0].alt ?? product.name}
                        fill
                        sizes="(min-width: 640px) 200px, 45vw"
                        className="object-cover"
                      />
                    )}
                  </Link>
                  <p className="text-sm font-semibold">{product.name}</p>
                  <p className="text-sm">
                    {/* The cheapest variant's price (sale price if it has one). */}
                    {formatPrice(Math.min(...product.variants.map((v) => pricing(v.price, v.salePrice).price)))}
                  </p>
                  <form action={removeFromWishlistAction}>
                    <input type="hidden" name="productId" value={product.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="-ml-2 text-muted-foreground"
                    >
                      <Trash2 /> Remove
                    </Button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 font-heading text-lg font-extrabold uppercase tracking-wide">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
