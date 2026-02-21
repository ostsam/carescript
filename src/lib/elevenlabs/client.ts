import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

if (!process.env.ELEVENLABS_API_KEY) {
  throw new Error("ELEVENLABS_API_KEY is not set");
}

// Singleton client — instantiated once per server process, never in the browser.
export const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});
