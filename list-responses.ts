import * as schemas from "./src/db/schema";
import { db } from "./src/db/client";
import { openai } from "./src/openai";

const responses = await db.select().from(schemas.responses);
console.log(responses);
// TODO: create a new array from responses with only the latest responseId based on createdAt

const items = await Promise.all(
  responses.map(async (r) => {
    const response = await openai.responses.inputItems.list(r.responseId, {
      limit: 100,
    });

    // console.log(response.data, r.userId);
    return response.data
      .filter((d) => d.role !== "system")
      .map((msg) => {
        // console.log(msg, r.userId);
        const content = msg.content[0]?.text;

        return {
          // ...msg,
          id: msg.id,
          content,
          userId: r.userId,
          role: msg.role,
        };
      });
  })
);

const flattenedItems = items.flat();

const uniqueItems = flattenedItems.filter(
  (item, index, self) =>
    index ===
    self.findIndex(
      (t) => t.content === item.content && t.userId === item.userId
    )
);

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
saveAsCSV(uniqueItems, "responses.csv");
