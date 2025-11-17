"use server";

import { getCart, updateCart } from "./cart";
import { getUser } from "./queries";
import { trackPurchaseServer } from "./analytics/server";
import { detailedCart } from "./cart";

export async function addToCart(prevState: unknown, formData: FormData) {
  const prevCart = await getCart();
  const productSlug = formData.get("productSlug");
  if (typeof productSlug !== "string") {
    return;
  }
  const itemAlreadyExists = prevCart.find(
    (item) => item.productSlug === productSlug,
  );
  if (itemAlreadyExists) {
    const newQuantity = itemAlreadyExists.quantity + 1;
    const newCart = prevCart.map((item) => {
      if (item.productSlug === productSlug) {
        return {
          ...item,
          quantity: newQuantity,
        };
      }
      return item;
    });
    await updateCart(newCart);
  } else {
    const newCart = [
      ...prevCart,
      {
        productSlug,
        quantity: 1,
      },
    ];
    await updateCart(newCart);
  }

  return "Item added to cart";
}

export async function removeFromCart(formData: FormData) {
  const prevCart = await getCart();
  const productSlug = formData.get("productSlug");
  if (typeof productSlug !== "string") {
    return;
  }
  const itemAlreadyExists = prevCart.find(
    (item) => item.productSlug === productSlug,
  );
  if (!itemAlreadyExists) {
    return;
  }
  const newCart = prevCart.filter((item) => item.productSlug !== productSlug);
  await updateCart(newCart);
}

export async function placeOrder() {
  const user = await getUser();
  if (!user) {
    return { error: "Must be logged in to place order" };
  }

  const cart = await detailedCart();
  if (cart.length === 0) {
    return { error: "Cart is empty" };
  }

  // Track purchase events for each item in cart using outbox pattern
  for (const item of cart) {
    const totalPrice = Number(item.price) * item.quantity;
    await trackPurchaseServer(
      user.id.toString(),
      item.slug,
      totalPrice,
      item.subcategory.subcollection.category_slug,
      {
        quantity: item.quantity,
        product_name: item.name,
        order_total: cart.reduce(
          (sum, i) => sum + Number(i.price) * i.quantity,
          0
        ),
      }
    );
  }

  // Clear the cart after purchase
  await updateCart([]);

  return { success: true, message: "Order placed successfully!" };
}
