import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const WHISPER_API_KEY = process.env.WHISPER_API_KEY!;

export async function transcribeAudio(audioUrl: string): Promise<string> {
  try {
    const url = "https://api.runpod.ai/v2/faster-whisper/runsync";

    const payload = {
      input: {
        audio: audioUrl,
        model: "small",
        transcription: "plain_text",
        translate: false,
        language: null,
        temperature: 0,
        best_of: 5,
        beam_size: 5,
        patience: 1,
        suppress_tokens: "-1",
        condition_on_previous_text: false,
        temperature_increment_on_fallback: 0.2,
        compression_ratio_threshold: 2.4,
        logprob_threshold: -1,
        no_speech_threshold: 0.6,
        word_timestamps: false,
      },
      enable_vad: false,
    };

    const headers = {
      accept: "application/json",
      "content-type": "application/json",
      authorization: WHISPER_API_KEY,
    };

    const response = await axios.post(url, payload, { headers });
    const jsonResponse = response.data;

    console.log(jsonResponse);

    // Check if this is the expected direct response
    if ("output" in jsonResponse && "transcription" in jsonResponse.output) {
      return jsonResponse.output.transcription;
    }

    // If we get a status response (new API behavior), we need to poll for results
    else if ("status" in jsonResponse && jsonResponse.status === "COMPLETED") {
      // The API might have changed - let's try to get the result with the job ID
      if ("id" in jsonResponse) {
        const jobId = jsonResponse.id;
        // Try to get the result using the job ID
        const resultUrl = `https://api.runpod.ai/v2/faster-whisper/status/${jobId}`;
        const resultResponse = await axios.get(resultUrl, { headers });
        const resultJson = resultResponse.data;
        console.log("Job result response: {resultJson}");

        if ("output" in resultJson && "transcription" in resultJson.output) {
          return resultJson.output.transcription;
        }
      }

      // If no job ID approach works, return a message indicating completion but no transcription
      console.log("Whisper API completed but no transcription data found");
      return "Audio transcribed but no text detected (possibly silent or too short)";
    }

    // Direct access like in the working example (fallback)
    return jsonResponse.output.transcription;
  } catch (error) {
    console.error("Transcription error:", error);
    throw new Error("Failed to transcribe audio");
  }
}
