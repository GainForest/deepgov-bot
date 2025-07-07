import axios from "axios";

export async function getCloudRunUrl(): Promise<string | undefined> {
  try {
    const serviceName = process.env.K_SERVICE;

    if (!serviceName) {
      console.log("⚠️  K_SERVICE not found, not running on Cloud Run");
      return undefined;
    }

    console.log("🔍 Getting Cloud Run service info from metadata server...");

    const headers = { "Metadata-Flavor": "Google" };

    // Get PROJECT_ID
    const projectResponse = await axios.get(
      "http://metadata.google.internal/computeMetadata/v1/project/project-id",
      { headers }
    );
    const projectId = projectResponse.data;
    console.log(`📋 Project ID: ${projectId}`);

    // Get REGION
    const regionResponse = await axios.get(
      "http://metadata.google.internal/computeMetadata/v1/instance/region",
      { headers }
    );
    const region = regionResponse.data.split("/").pop();
    console.log(`🌍 Region: ${region}`);

    // Get ACCESS_TOKEN
    const tokenResponse = await axios.get(
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
      { headers }
    );
    const accessToken = tokenResponse.data.access_token;
    console.log("🔑 Access token obtained");

    // Call Cloud Run API to get service info
    const serviceApiUrl = `https://${region}-run.googleapis.com/apis/serving.knative.dev/v1/namespaces/${projectId}/services/${serviceName}`;
    console.log(`🔍 Calling Cloud Run API: ${serviceApiUrl}`);

    const serviceResponse = await axios.get(serviceApiUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    // Extract URL from service status
    const serviceUrl = serviceResponse.data.status?.url;

    if (serviceUrl) {
      console.log(`🌐 Detected Cloud Run service URL: ${serviceUrl}`);
      return serviceUrl;
    } else {
      console.error("❌ No URL found in service response");
      console.log(
        "Service response:",
        JSON.stringify(serviceResponse.data, undefined, 2)
      );
      return undefined;
    }
  } catch (error) {
    console.error("❌ Error getting Cloud Run URL:", error);
    if (axios.isAxiosError(error)) {
      console.error("Response status:", error.response?.status);
      console.error("Response data:", error.response?.data);
    }
    return undefined;
  }
}
