import * as schemas from "./src/db/schema";
import { db } from "./src/db/client";
import { openai } from "./src/openai";
import { writeFileSync } from "fs";

// Get all responses from database
const responses = await db.select().from(schemas.responses);

// Fetch response items for each response
const allItems = await Promise.all(
  responses.map(async (r) => {
    const response = await openai.responses.inputItems.list(r.responseId, {
      limit: 100,
    });

    return response.data
      .filter((item: any) => item.role !== "system")
      .map((msg: any) => ({
        id: msg.id,
        content: msg.content[0]?.text,
        userId: r.userId,
        role: msg.role,
      }));
  })
);

// Flatten and deduplicate items
const uniqueItems = allItems
  .flat()
  .filter(
    (item, index, self) =>
      index ===
      self.findIndex(
        (t) => t.content === item.content && t.userId === item.userId
      )
  );

// Export to CSV
function saveAsCSV(data: any[], filename: string) {
  if (data.length === 0) {
    console.log("No data to export");
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(","),
    ...data.map((item) =>
      headers
        .map((header) => {
          const value = String(item[header] || "");
          const escaped = value.replace(/"/g, '""');
          return escaped.includes(",") || escaped.includes("\n")
            ? `"${escaped}"`
            : escaped;
        })
        .join(",")
    ),
  ].join("\n");

  writeFileSync(filename, csvContent);
  console.log(`CSV saved to ${filename}`);
}

saveAsCSV(uniqueItems, "responses.csv");
