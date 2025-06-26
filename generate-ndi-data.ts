import { eq } from "drizzle-orm";
import { db } from "./src/db/client";
import { proofs } from "./src/db/schema";
import * as schemas from "./src/db/schema";

const userIds = await db
  .selectDistinct({ userId: schemas.responses.userId })
  .from(schemas.responses)
  .then((r) => r.map((u) => u.userId));

const users = await db.select().from(schemas.proofs);
console.log(userIds, userIds.length);
// console.log(users, users.length);

const userIdsWithoutProofs = userIds.filter(
  (id) => !users.some((u) => u.userId === id)
);
console.log(userIdsWithoutProofs);

// Function to generate mock data for specific user IDs
function generateMockDataForUsers(userIds: string[]) {
  const bhutaneseCities = [
    { city: "Thimphu", gewog: "Chang Gewog" },
    { city: "Paro", gewog: "Dopshari Gewog" },
    { city: "Bumthang", gewog: "Chumey Gewog" },
    { city: "Trongsa", gewog: "Chhoekhor Gewog" },
    { city: "Wangdue Phodrang", gewog: "Gangtey Gewog" },
    { city: "Punakha", gewog: "Toewang Gewog" },
    { city: "Haa", gewog: "Sombaykha Gewog" },
    { city: "Samtse", gewog: "Tading Gewog" },
    { city: "Chhukha", gewog: "Darla Gewog" },
    { city: "Mongar", gewog: "Saling Gewog" },
  ];

  const genders = ["Male", "Female"] as const;

  return userIds.map((userId, index) => {
    const cityIndex = index % bhutaneseCities.length;
    const cityData = bhutaneseCities[cityIndex]!;
    const genderIndex = index % genders.length;
    const gender = genders[genderIndex]!;
    const year = 1985 + (index % 20); // Random year between 1985-2004
    const month = 1 + (index % 12);
    const day = 1 + (index % 28);

    return {
      userId,
      did: `did:mock:${userId}_${Date.now()}_${index}`,
      gender,
      dob:
        new Date(year, month - 1, day).toISOString().split("T")[0] ||
        `${year}-${month.toString().padStart(2, "0")}-${day
          .toString()
          .padStart(2, "0")}`, // Convert to YYYY-MM-DD format
      citizenship: "Bhutanese",
      address1: cityData.city,
      address2: cityData.city,
      address3: cityData.gewog,
    };
  });
}

// Insert mock data for users without proofs
async function insertMockDataForUsersWithoutProofs() {
  try {
    if (userIdsWithoutProofs.length === 0) {
      console.log(
        "No users without proofs found. All users already have proof data."
      );
      return;
    }

    const mockData = generateMockDataForUsers(userIdsWithoutProofs);

    for (const userData of mockData) {
      console.log(userData);

      // TODO: Update the user data in the database
      //   await db
      //     .update(schemas.proofs)
      //     .set(userData)
      //     .where(eq(schemas.proofs.userId, userData.userId));
      await db.insert(proofs).values(userData);
    }

    console.log(
      `Successfully inserted mock data for ${userIdsWithoutProofs.length} users without proofs`
    );
    console.log("Users updated:", userIdsWithoutProofs);
  } catch (error) {
    console.error("Error inserting mock data:", error);
  }
}

// Execute the insertion
await insertMockDataForUsersWithoutProofs();
