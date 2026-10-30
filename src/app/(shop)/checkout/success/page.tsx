import type { Metadata } from "next";
import { OrderConfirmation } from "@/components/bag/order-confirmation";

export const metadata: Metadata = {
  title: "Thank you",
  robots: { index: false, follow: false },
};

/** Where Stripe sends shoppers after paying. The order details load in the browser (see OrderConfirmation). */
export default async function CheckoutSuccessPage({
  searchParams,
}: PageProps<"/checkout/success">) {
  const { session_id } = await searchParams;
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <OrderConfirmation sessionId={typeof session_id === "string" ? session_id : ""} />
    </div>
  );
}
