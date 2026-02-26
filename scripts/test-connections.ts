import { createClient } from "@deepgram/sdk";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
const deepgramKey = process.env.DEEPGRAM_API_KEY;
const agentId = process.env.ELEVENLABS_AGENT_ID;

console.log("Keys loaded:", {
    deepgram: !!deepgramKey,
    elevenlabs: !!elevenLabsKey,
    agentId
});

async function run() {
    // 1. Deepgram Test
    console.log("\n--- Testing Deepgram Live Token ---");
    const dgClient = createClient(deepgramKey);
    const { result, error } = await dgClient.auth.grantToken({ ttl_seconds: 60 });

    if (error) {
        console.error("Deepgram Token Failed:", error);
    } else {
        console.log("Deepgram Token success!", result.access_token.substring(0, 10) + "...");

        // Try actual WS connection WITH THE EPHEMERAL TOKEN
        const tempClient = createClient(result.access_token);
        const live = tempClient.listen.live({ model: "nova-2" });
        live.on("open", () => {
            console.log("Deepgram WS Connection OPENED successfully.");
            live.requestClose();
        });
        live.on("close", (e) => {
            console.log("Deepgram WS Connection CLOSED", e);
        });
        live.on("error", (e) => {
            console.log("Deepgram WS Error!", e);
        });
    }

    // 2. ElevenLabs Test
    console.log("\n--- Testing ElevenLabs Agent Token ---");
    try {
        const response = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/get_signed_url?agent_id=${agentId}`, {
            headers: { "xi-api-key": elevenLabsKey! }
        });
        const data = await response.json();
        console.log("ElevenLabs response status:", response.status);
        console.log("ElevenLabs data:", data);
    } catch (err) {
        console.error("ElevenLabs fetch error:", err);
    }
}

run();
