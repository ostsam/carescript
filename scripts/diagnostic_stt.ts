import { createClient } from "@deepgram/sdk";
import * as dotenv from "dotenv";

dotenv.config();

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

if (!DEEPGRAM_API_KEY) {
    console.error("❌ DEEPGRAM_API_KEY is missing from environment");
    process.exit(1);
}

const deepgram = createClient(DEEPGRAM_API_KEY);

// A tiny 1-second silent mono 16kHz WAV file header + silence
const silentWav = Buffer.from([
    0x52, 0x49, 0x46, 0x46, // "RIFF"
    0x24, 0x00, 0x00, 0x00, // ChunkSize
    0x57, 0x41, 0x56, 0x45, // "WAVE"
    0x66, 0x6d, 0x74, 0x20, // "fmt "
    0x10, 0x00, 0x00, 0x00, // Subchunk1Size (16)
    0x01, 0x00, 0x01, 0x00, // AudioFormat (PCM), NumChannels (1)
    0x80, 0x3e, 0x00, 0x00, // SampleRate (16000)
    0x80, 0x7d, 0x00, 0x00, // ByteRate (16000 * 2)
    0x02, 0x00, 0x10, 0x00, // BlockAlign (2), BitsPerSample (16)
    0x64, 0x61, 0x74, 0x61, // "data"
    0x00, 0x04, 0x00, 0x00, // Subchunk2Size (1024 bytes of silence)
    ...new Array(1024).fill(0)
]);

const MODELS_TO_TEST = ["nova-3-medical", "nova-3", "nova-2"];

async function runDiagnostics() {
    console.log("🚀 Starting Deepgram Parameter Stress Test...\n");

    for (const model of MODELS_TO_TEST) {
        console.log(`--- Testing [${model}] ---`);

        const tests = [
            { name: "Baseline", params: { model, smart_format: true } },
            { name: "Diarization", params: { model, smart_format: true, diarize: true } },
            { name: "Utterances", params: { model, smart_format: true, utterances: true } },
            {
                name: "All (Production)", params: {
                    model,
                    diarize: true,
                    smart_format: true,
                    punctuate: true,
                    utterances: true,
                    filler_words: true
                }
            },
            {
                name: "Keywords Support", params: {
                    model,
                    keywords: ["metoprolol", "test"],
                }
            },
        ];

        for (const test of tests) {
            process.stdout.write(`  - ${test.name.padEnd(20)}: `);
            try {
                const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
                    silentWav,
                    test.params
                );

                if (error) {
                    console.log(`❌ FAILED (${error.message})`);
                } else {
                    console.log(`✅ OK`);
                }
            } catch (err: any) {
                console.log(`❌ CRASHED (${err.message})`);
            }
        }
        console.log("");
    }

    console.log("🏁 Diagnostics Complete.");
}

runDiagnostics();
