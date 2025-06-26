import axios, { AxiosError } from "axios";
import dotenv from "dotenv";
import { findProfile } from "./db/api";

dotenv.config();

const NDI_CLIENT_ID = process.env.NDI_CLIENT_ID!;
const NDI_CLIENT_SECRET = process.env.NDI_CLIENT_SECRET!;
const BASE_URL = process.env.BASE_URL!;
const WEBHOOK_ID = process.env.WEBHOOK_ID!;

const NDI_BASE_URL = "https://demo-client.bhutanndi.com";
const NDI_AUTH_URL =
  "https://staging.bhutanndi.com/authentication/v1/authenticate";
const NDI_WEBHOOK_URL = `${NDI_BASE_URL}/webhook/v1`;
const NDI_VERIFIER_URL = `${NDI_BASE_URL}/verifier/v1/proof-request`;
const NDI_ISSUER_URL = `${NDI_BASE_URL}/issuer/v1/issue-credential`;
const FOUNDATION_ID_SCHEMA =
  "https://dev-schema.ngotag.com/schemas/c7952a0a-e9b5-4a4b-a714-1e5d0a1ae076";
const ADDRESS_ID_SCHEMA =
  "https://dev-schema.ngotag.com/schemas/e3b606d0-e477-4fc2-b5ab-0adc4bd75c54";
const CIVIC_CHAMPION_ID_SCHEMA =
  "https://dev-schema.ngotag.com/schemas/8c9df463-776f-49d9-8684-e98895a31f0a";

let ndiAccessToken: string | null = null;
export const threadMap = new Map<string, { chatId: number; userId: number }>();

export async function getNdiAccessToken(): Promise<string> {
  if (ndiAccessToken) return ndiAccessToken;

  const res = await axios.post(NDI_AUTH_URL, {
    client_id: NDI_CLIENT_ID,
    client_secret: NDI_CLIENT_SECRET,
    grant_type: "client_credentials",
  });

  ndiAccessToken = res.data.access_token;
  return ndiAccessToken;
}

export async function makeNdiRequest(
  method: "get" | "post",
  url: string,
  data?: any
) {
  const token = await getNdiAccessToken();
  return axios({
    method,
    url,
    data,
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function webhookExists(): Promise<boolean> {
  try {
    const response = await makeNdiRequest(
      "get",
      `${NDI_WEBHOOK_URL}?pageSize=10&page=1&webhookId=${WEBHOOK_ID}`
    );
    const webhooks = response.data.data?.webhooks || [];
    return webhooks.some((webhook: any) => webhook.webhookId === WEBHOOK_ID);
  } catch (err) {
    return (err as AxiosError).response?.status !== 404;
  }
}

export async function ensureWebhook() {
  if (await webhookExists()) return;

  try {
    const token = await getNdiAccessToken();
    await makeNdiRequest("post", `${NDI_WEBHOOK_URL}/register`, {
      webhookId: WEBHOOK_ID,
      webhookURL: BASE_URL + "/webhook",
      authentication: { type: "OAuth2", version: "v2", data: { token } },
    });
    console.log("Webhook registered");
  } catch (err) {
    if ((err as AxiosError).response?.status !== 409) throw err;
  }
}

export async function createProofRequest(
  chatId: number,
  userId: number
): Promise<string> {
  const proofAttributes = [
    ...["Gender", "Date of Birth", "Citizenship"].map((name) => ({
      name,
      restrictions: [{ schema_name: FOUNDATION_ID_SCHEMA }],
    })),
    ...["Village", "Gewog", "Dzongkhag"].map((name) => ({
      name,
      restrictions: [{ schema_name: ADDRESS_ID_SCHEMA }],
    })),
  ];

  const proofRes = await makeNdiRequest("post", NDI_VERIFIER_URL, {
    proofName: "Telegram NDI Auth",
    proofAttributes,
  });

  const { proofRequestThreadId, deepLinkURL } = proofRes.data.data;
  threadMap.set(proofRequestThreadId, { chatId, userId });

  try {
    await makeNdiRequest("post", `${NDI_WEBHOOK_URL}/subscribe`, {
      webhookId: WEBHOOK_ID,
      threadId: proofRequestThreadId,
    });
  } catch (err) {
    if ((err as AxiosError).response?.status !== 409) throw err;
  }

  return deepLinkURL;
}

export async function issueCredential(chatId: string, userId: string) {
  const credentialData = {
    "Issue Date": new Date().toLocaleDateString(),
    "Issued By": "DeepGov",
  };

  const profile = await findProfile(userId);

  const issueRes = await makeNdiRequest("post", NDI_ISSUER_URL, {
    credentialData,
    schemaId: CIVIC_CHAMPION_ID_SCHEMA,
    holderDID: profile?.did,
  });

  const { issueCredThreadId, deepLinkURL } = issueRes.data.data;
  threadMap.set(issueCredThreadId, { chatId, userId });

  try {
    await makeNdiRequest("post", `${NDI_WEBHOOK_URL}/subscribe`, {
      webhookId: WEBHOOK_ID,
      threadId: issueCredThreadId,
    });
  } catch (err) {
    if ((err as AxiosError).response?.status !== 409) throw err;
  }

  return deepLinkURL;
}
