import { eq } from "drizzle-orm";
import * as schemas from "./src/db/schema";
import { db } from "./src/db/client";
import { openai } from "./src/openai";
import { sql } from "drizzle-orm";

// Query to get only the latest response for each userId
const responses = await db
  .execute(
    sql`
  SELECT DISTINCT ON (user_id) *
  FROM responses
  ORDER BY user_id, created_at DESC
`
  )
  .then((r) => r.rows);

// Query all
// const responses = await db.select().from(schemas.responses);
console.log(responses);

const items = await Promise.all(
  responses.map(async (r) => {
    const response = await openai.responses.inputItems.list(r.responseId, {
      limit: 100,
    });

    return response.data
      .filter((d) => d.role !== "system")
      .map((msg) => ({
        // ...msg,
        id: msg.id,
        content: msg.content[0]?.text,
        userId: r.userId,
        role: msg.role,
      }));
  })
);
console.log(JSON.stringify(items, null, 2));

// TODO: Save as csv

// Flatten the items array
const flattenedItems = items.flat();

// Simple CSV export
function saveAsCSV(data: any[], filename: string) {
  if (data.length === 0) {
    console.log("No data to export");
    return;
  }

  // Get headers from first item
  const headers = Object.keys(data[0]);

  // Create CSV content
  const csvContent = [
    headers.join(","),
    ...data.map((item) =>
      headers
        .map((header) => {
          const value = item[header];
          // Escape quotes and wrap in quotes if contains comma or newline
          const escaped = String(value || "").replace(/"/g, '""');
          return escaped.includes(",") || escaped.includes("\n")
            ? `"${escaped}"`
            : escaped;
        })
        .join(",")
    ),
  ].join("\n");

  // Write to file
  const fs = require("fs");
  fs.writeFileSync(filename, csvContent);
  console.log(`CSV saved to ${filename}`);
}

// Save the data
saveAsCSV(flattenedItems, "responses.csv");
