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

  const contentURL = `https://raw.githubusercontent.com/evalscience/deepgov-gg24/refs/heads/main/agents`;
  const agentName = "etherowl";

  const result = [{
    name: agentName,
    style: (await axios.get(`${contentURL}/${agentName}/modelspec/style.md`)).data,
    constitution: (
      await axios.get(`${contentURL}/${agentName}/modelspec/constitution.md`)
    ).data,
  }];

  // Update cache
  cache.data = result;
  cache.timestamp = now;

  return result;
}
