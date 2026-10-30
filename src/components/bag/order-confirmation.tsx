"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { reloadBag } from "@/lib/bag-store";
import { confirmOrderAction, type ConfirmedOrder } from "@/lib/checkout/actions";
import { formatPrice } from "@/lib/format";

/**
 * The thank-you message. Asks the server to confirm the order; card payments
 * are usually confirmed at once, so it tries a few times before saying
 * "we'll email you".
 */
export function OrderConfirmation({ sessionId }: { sessionId: string }) {
  const [order, setOrder] = useState<ConfirmedOrder | null>(null);
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    let stopped = false;
    (async () => {
      for (let attempt = 0; attempt < 5 && !stopped; attempt++) {
        const found = await confirmOrderAction(sessionId).catch(() => null);
        if (found) {
          setOrder(found);
          void reloadBag(); // the bag icon drops the paid items
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!stopped) setGaveUp(true);
    })();
    return () => {
      stopped = true;
    };
  }, [sessionId]);

  return (
    <>
      {order ? (
        <>
          <CheckCircle2 className="mx-auto size-12 text-brand-accent" aria-hidden />
          <h1 className="text-display mt-4 text-3xl sm:text-4xl">Thank you!</h1>
          <p className="mt-3 text-muted-foreground">
            Your order <strong className="text-foreground">{order.number}</strong> (
            {formatPrice(order.total)}) is confirmed. We&apos;ve emailed a receipt to{" "}
            <strong className="text-foreground">{order.email}</strong> and we&apos;ll let you know
            when it&apos;s on its way.
          </p>
        </>
      ) : gaveUp ? (
        <>
          <Clock className="mx-auto size-12 text-muted-foreground" aria-hidden />
          <h1 className="text-display mt-4 text-3xl sm:text-4xl">Almost there</h1>
          <p className="mt-3 text-muted-foreground">
            We&apos;re waiting for your payment to be confirmed. You&apos;ll get an email as soon as
            it is — no need to pay again.
          </p>
        </>
      ) : (
        <div className="grid min-h-40 place-items-center">
          <Loader2
            className="size-8 animate-spin text-muted-foreground"
            aria-label="Confirming your order"
          />
        </div>
      )}
      <Link href="/" className={buttonVariants({ className: "mt-8 h-11 px-6" })}>
        Keep shopping
      </Link>
    </>
  );
}
