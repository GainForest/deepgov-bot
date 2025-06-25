import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const WHISPER_API_KEY = process.env.WHISPER_API_KEY!;

export async function transcribeAudio(audioUrl: string): Promise<string> {
  const url = "https://api.runpod.ai/v2/faster-whisper/runsync";

  const headers = {
    accept: "application/json",
    "content-type": "application/json",
    authorization: WHISPER_API_KEY,
  };
  const { data } = await axios.post(
    url,
    {
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
    },
    { headers }
  );

  // If we get a job ID, poll the status endpoint
  if ("id" in data) {
    const jobId = data.id;
    const statusUrl = `https://api.runpod.ai/v2/faster-whisper/status/${jobId}`;
    const statusResponse = await axios.get(statusUrl, { headers });
    return statusResponse.data.output.transcription;
  }

  // Direct response
  return data.output.transcription;
}
