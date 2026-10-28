"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "cn";
import { FormAlert } from "@/components/auth/form-bits";
import { Button } from "@/components/ui/button";
import { cancelOrderAction, refundOrderAction, shipOrderAction } from "@/lib/admin/order-actions";
import { formatPrice } from "@/lib/format";
import { AdminField, Panel, inputClass } from "./ui";
import { useAdminForm } from "./use-admin-form";

type Order = { id: string; number: string; status: string; total: number; trackingNumber: string | null; trackingUrl: string | null };

/**
 * The buttons on an order: Mark as shipped (anyone on the team), Cancel and
 * Refund (admins only — they give money back). The server checks all of this
 * again; hiding a button here is only for tidiness.
 */
export function OrderActions({ order, isAdmin, hasPayment }: { order: Order; isAdmin: boolean; hasPayment: boolean }) {
  // All three live here (not inside each form) so the result message stays after the order changes and a form goes away.
  const ship = useAdminForm(shipOrderAction);
  const cancel = useAdminForm(cancelOrderAction);
  const refund = useAdminForm(refundOrderAction);
  const [confirming, setConfirming] = useState<"cancel" | "refund" | null>(null);
  const last = [ship.state, cancel.state, refund.state].filter(Boolean);
  const busy = ship.pending || cancel.pending || refund.pending;

  const canShip = order.status === "PAID" || order.status === "SHIPPED";
  const canCancel = isAdmin && order.status === "PAID";
  const canRefund = isAdmin && (order.status === "PAID" || order.status === "SHIPPED");

  return (
    <Panel title={order.status === "PAID" ? "Ship this order" : "Actions"}>
      <div className="grid gap-3" aria-live="polite">
        {last.map((s, n) => (
          <div key={n} className="grid gap-2">
            {s?.error && <FormAlert tone="error">{s.error}</FormAlert>}
            {s?.message && <FormAlert tone="success">{s.message}</FormAlert>}
          </div>
        ))}

        {canShip && (
          <form onSubmit={ship.onSubmit} className="grid gap-3">
            <input type="hidden" name="orderId" value={order.id} />
            <AdminField label="Tracking number" error={ship.state?.fieldErrors?.trackingNumber}>
              <input name="trackingNumber" defaultValue={order.trackingNumber ?? ""} required minLength={3} maxLength={60} autoComplete="off" className={cn(inputClass, "font-mono")} />
            </AdminField>
            <AdminField label="Tracking link (optional)" hint="The courier’s tracking page — the email gets a “Track my parcel” button." error={ship.state?.fieldErrors?.trackingUrl}>
              <input name="trackingUrl" type="url" defaultValue={order.trackingUrl ?? ""} maxLength={500} placeholder="https://auspost.com.au/mypost/track/details/…" className={inputClass} />
            </AdminField>
            {order.status === "SHIPPED" && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="notify" defaultChecked className="size-4 accent-brand-ink" /> Email the customer the new details
              </label>
            )}
            <Button type="submit" disabled={busy} className="h-10 gap-1.5">
              {ship.pending && <Loader2 className="animate-spin" />}
              {order.status === "PAID" ? "Mark as shipped & email customer" : "Save tracking details"}
            </Button>
          </form>
        )}

        {(canCancel || canRefund) && (
          <div className="grid gap-2 border-t border-border pt-3">
            {(cancel.pending || refund.pending) && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Refunding through Stripe…
              </p>
            )}
            {!hasPayment && <p className="text-xs text-muted-foreground">This order has no Stripe payment, so it can’t be refunded here.</p>}

            {confirming === null && (
              <div className="flex flex-wrap gap-2">
                {canCancel && (
                  <Button type="button" variant="outline" disabled={busy || !hasPayment} onClick={() => setConfirming("cancel")} className="h-9 flex-1">
                    Cancel order
                  </Button>
                )}
                {canRefund && (
                  <Button type="button" variant="outline" disabled={busy || !hasPayment} onClick={() => setConfirming("refund")} className="h-9 flex-1">
                    Refund
                  </Button>
                )}
              </div>
            )}

            {confirming === "cancel" && (
              <form onSubmit={(e) => (cancel.onSubmit(e), setConfirming(null))} className="grid gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-900">
                <input type="hidden" name="orderId" value={order.id} />
                <p>
                  Cancel {order.number}? The customer gets <strong>{formatPrice(order.total)}</strong> back on their card, the items go back in stock, and they’re emailed.
                </p>
                <ConfirmButtons pending={cancel.pending} yes="Yes, cancel and refund" no="Keep the order" onNo={() => setConfirming(null)} />
              </form>
            )}

            {confirming === "refund" && (
              <form onSubmit={(e) => (refund.onSubmit(e), setConfirming(null))} className="grid gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-900">
                <input type="hidden" name="orderId" value={order.id} />
                <p>
                  Refund <strong>{formatPrice(order.total)}</strong> for {order.number} to the customer’s card? They’re emailed a refund confirmation. This can’t be undone.
                </p>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="restock" defaultChecked={order.status === "PAID"} className="size-4 accent-brand-ink" /> Put the items back in stock
                </label>
                <ConfirmButtons pending={refund.pending} yes="Yes, refund" no="Don’t refund" onNo={() => setConfirming(null)} />
              </form>
            )}
          </div>
        )}

        {!canShip && !canRefund && <p className="text-sm text-muted-foreground">This order is {order.status.toLowerCase()} — there’s nothing left to do.</p>}
        {!isAdmin && canShip && <p className="text-xs text-muted-foreground">Only admins can cancel or refund orders.</p>}
      </div>
    </Panel>
  );
}

function ConfirmButtons({ pending, yes, no, onNo }: { pending: boolean; yes: string; no: string; onNo: () => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="submit" variant="destructive" disabled={pending} className="h-9 gap-1.5">
        {pending && <Loader2 className="animate-spin" />}
        {yes}
      </Button>
      <Button type="button" variant="ghost" onClick={onNo} className="h-9">
        {no}
      </Button>
    </div>
  );
}
