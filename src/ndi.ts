import axios, { AxiosError } from "axios";
import dotenv from "dotenv";

dotenv.config();

const NDI_CLIENT_ID = process.env.NDI_CLIENT_ID!;
const NDI_CLIENT_SECRET = process.env.NDI_CLIENT_SECRET!;
const WEBHOOK_URL = process.env.WEBHOOK_URL!;
const WEBHOOK_ID = "tg-webhook-4";

const NDI_AUTH_URL =
  "https://staging.bhutanndi.com/authentication/v1/authenticate";
const NDI_WEBHOOK_URL = "https://demo-client.bhutanndi.com/webhook/v1";
const NDI_VERIFIER_URL =
  "https://demo-client.bhutanndi.com/verifier/v1/proof-request";
const FOUNDATION_ID_SCHEMA =
  "https://dev-schema.ngotag.com/schemas/c7952a0a-e9b5-4a4b-a714-1e5d0a1ae076";
const ADDRESS_ID_SCHEMA =
  "https://dev-schema.ngotag.com/schemas/e3b606d0-e477-4fc2-b5ab-0adc4bd75c54";

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
      webhookURL: WEBHOOK_URL,
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
