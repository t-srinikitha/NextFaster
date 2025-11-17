"use client";
import { useActionState } from "react";
import { addToCart } from "@/lib/actions";
import { trackAddToCart } from "@/lib/analytics/client";

interface AddToCartFormProps {
  productSlug: string;
  productName?: string;
  price?: number;
  category?: string;
}

export function AddToCartForm({ 
  productSlug, 
  productName, 
  price, 
  category 
}: AddToCartFormProps) {
  const [message, formAction, isPending] = useActionState(addToCart, null);

  const handleSubmit = async (formData: FormData) => {
    // Track add to cart event
    if (productName && price !== undefined) {
      trackAddToCart(productSlug, productName, price, category);
    }
    formAction(formData);
  };

  return (
    <form className="flex flex-col gap-2" action={handleSubmit}>
      <input type="hidden" name="productSlug" value={productSlug} />
      <button
        type="submit"
        className="max-w-[150px] rounded-[2px] bg-accent1 px-5 py-1 text-sm font-semibold text-white"
      >
        Add to cart
      </button>
      {isPending && <p>Adding to cart...</p>}
      {!isPending && message && <p>{message}</p>}
    </form>
  );
}
