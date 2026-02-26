This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# ElevenLabs Intervention & Reporting System Walkthrough

The following diagram illustrates the data flow from Deepgram transcription through the hostility classifier to the ElevenLabs agent, and finally the post-session OpenAI reporting.

```mermaid
sequenceDiagram
    participant User as Nurse/Patient
    participant DG as Deepgram Live
    participant IC as Intervention Controller (Hook)
    participant EL as ElevenLabs Agent
    participant API as Carescript API
    participant DB as Database
    participant AI as OpenAI (GPT-4o-mini)

    User->>DG: Audio Stream
    DG->>IC: Diarized Transcripts
    Note over IC: Heuristic Rolling Window Check
    
    IC->>IC: Hostility Detected?
    alt Automatic Trigger
        IC->>IC: Trigger Pending (10s)
        IC->>API: POST /api/elevenlabs/token
        API-->>IC: Signed URL (Safety)
        IC->>EL: Start Session
    else Manual Override
        User->>IC: Click "Trigger Intervention"
        IC->>EL: Start Session (Immediate)
    end

    EL->>User: Audio De-escalation
    Note over IC: Listening for Compliance
    User->>IC: "Okay, I'll calm down"
    IC->>EL: End Session
    
    User->>IC: Save Session
    IC->>API: POST /api/sessions/[id]/report (Async)
    API->>DB: Fetch Transcript
    API->>AI: Generate SOAP Note
    AI-->>API: Structured Sections
    API->>DB: INSERT clinicalNotes (Status: Draft)
```
