// scripts/seed-events.ts

import { createClient } from "@clickhouse/client";
import { randomUUID } from "crypto";

const ch = createClient({
  url: process.env.CLICKHOUSE_URL!,
  username: process.env.CLICKHOUSE_USER!,
  password: process.env.CLICKHOUSE_PASSWORD!,
});

async function seed(n = 10000) {
  const rows = [];

  for (let i = 0; i < n; i++) {
    const ts = new Date(
      Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 24)
    ).toISOString();

    rows.push({
      event_id: randomUUID(),
      event_time: ts.replace("T", " ").replace("Z", ""),
      event_date: ts.slice(0, 10),
      user_id: `user-${Math.floor(Math.random() * 200)}`,
      session_id: `sess-${Math.floor(Math.random() * 10000)}`,
      event_type:
        Math.random() < 0.02
          ? "purchase"
          : Math.random() < 0.2
            ? "add_to_cart"
            : "product_view",
      product_id: `prod-${1 + Math.floor(Math.random() * 100)}`,
      category: `cat-${1 + Math.floor(Math.random() * 10)}`,
      price: Number((Math.random() * 500).toFixed(2)),
      page: "/product",
      referrer: "organic",
      device_family: Math.random() < 0.5 ? "mobile" : "desktop",
      country: "IN",
      properties: JSON.stringify({ seed: true }),
    });
  }

  await ch.insert({
    table: `${process.env.CLICKHOUSE_DATABASE}.events`,
    format: "JSONEachRow",
    values: rows,
  });

  console.log("seeded", n);
  process.exit(0);
}

seed(process.argv[2] ? Number(process.argv[2]) : 10000).catch((e) =>
  console.error(e)
);


