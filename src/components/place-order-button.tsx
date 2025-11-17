"use client";

import { useActionState } from "react";
import { placeOrder } from "@/lib/actions";

export function PlaceOrderButton() {
  const [result, formAction, isPending] = useActionState(placeOrder, null);

  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-[2px] bg-accent1 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {isPending ? "Placing Order..." : "Place Order"}
      </button>
      {result?.error && (
        <p className="mt-2 text-sm text-red-600">{result.error}</p>
      )}
      {result?.success && (
        <p className="mt-2 text-sm text-green-600">{result.message}</p>
      )}
    </form>
  );
}


