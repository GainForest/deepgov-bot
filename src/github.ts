import axios from "axios";

// Simple cache with timestamp for invalidation
let cache: {
  data: { name: string; style: string; constitution: string }[] | null;
  timestamp: number | null;
} = { data: null, timestamp: null };

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

export async function fetchModelSpecs(): Promise<
  { name: string; style: string; constitution: string }[]
> {
  // Check if cache is valid
  const now = Date.now();
  if (cache.data && cache.timestamp && now - cache.timestamp < CACHE_DURATION) {
    return cache.data;
  }

  const baseURL = `https://api.github.com/repos/evalscience/deepgov-bhutan/contents/agents`;
  const contentURL = `https://raw.githubusercontent.com/evalscience/deepgov-bhutan/refs/heads/main/agents`;

  const response = await axios.get(baseURL);
  const folders = response.data
    .filter((item: { name: string; type: string }) => item.type === "dir")
    .map((item: { name: string; type: string }) => item.name);

  const result = await Promise.all(
    folders.map(async (name: string) => ({
      name,
      style: (await axios.get(`${contentURL}/${name}/modelspec/style.md`)).data,
      constitution: (
        await axios.get(`${contentURL}/${name}/modelspec/constitution.md`)
      ).data,
    }))
  );

  // Update cache
  cache.data = result;
  cache.timestamp = now;

  return result;
}
