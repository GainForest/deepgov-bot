import { openai } from "./src/openai";

const response = await openai.responses.inputItems.list(
  "resp_685c2a9c30448192bdcde7fa627f408604b679293f2fb9d9",
  { limit: 100 }
);

console.log(
  JSON.stringify(
    response.data.filter((d) => d.role === "user"),
    null,
    2
  )
);

console.log(response);
