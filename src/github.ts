import axios from "axios";

export async function fetchModelSpecs(): Promise<
  { name: string; style: string; constitution: string }[]
> {
  const baseURL = `https://api.github.com/repos/evalscience/deepgov-bhutan/contents/agents`;
  const contentURL = `https://raw.githubusercontent.com/evalscience/deepgov-bhutan/refs/heads/main/agents`;

  const response = await axios.get(baseURL);
  const folders = response.data
    .filter((item: { name: string; type: string }) => item.type === "dir")
    .map((item: { name: string; type: string }) => item.name);

  return Promise.all(
    folders.map(async (name: string) => ({
      name,
      style: (await axios.get(`${contentURL}/${name}/modelspec/style.md`)).data,
      constitution: (
        await axios.get(`${contentURL}/${name}/modelspec/constitution.md`)
      ).data,
    }))
  );
}
