import * as dotenv from "dotenv";

dotenv.config();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const AGENT_ID = process.env.ELEVENLABS_AGENT_ID;

async function verifyElevenLabs() {
    console.log("🚀 Starting ElevenLabs Agent Diagnostics...\n");

    if (!ELEVENLABS_API_KEY) {
        console.error("❌ ELEVENLABS_API_KEY is missing");
        return;
    }

    if (!AGENT_ID) {
        console.error("❌ ELEVENLABS_AGENT_ID is missing");
        return;
    }

    console.log(`Testing Agent ID: ${AGENT_ID}`);

    try {
        const res = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`, {
            headers: { "xi-api-key": ELEVENLABS_API_KEY },
        });

        if (res.ok) {
            const data = await res.json();
            console.log(`✅ SUCCESS: Agent "${data.name}" is reachable.`);
        } else {
            const error = await res.text();
            console.log(`❌ FAILED: Status ${res.status}`);
            console.log(`   Reason: ${error}`);
        }
    } catch (err: any) {
        console.log(`❌ CRASHED: ${err.message}`);
    }
}

verifyElevenLabs();
