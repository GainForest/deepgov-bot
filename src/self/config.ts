import { SelfAppBuilder } from "@selfxyz/qrcode";
import getUuid from "uuid-by-string";
import { logo } from "./logo";

export const createSelfApp = (userId: string) => {
  const userIdUuId = getUuid(userId);

  const selfApp = new SelfAppBuilder({
    appName: "GainForest Bot",
    scope: "gainforest",
    endpoint: `${process.env.SELF_BACKEND_ENDPOINT}/api/verify`,
    logoBase64: logo, // You can add a base64 logo here if needed
    userId: userIdUuId,
    disclosures: {
      nationality: true,
      gender: true,
      date_of_birth: true,
      excludedCountries: [],
    },
    version: 2,
    userDefinedData: "I am authenticating to the GainForest Bot",
  }).build();

  return selfApp;
};
