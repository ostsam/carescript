import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
dotenv.config();

const url = process.env.NEON_DATABASE_URL;
if (!url) {
    console.error("Missing NEON_DATABASE_URL");
    process.exit(1);
}

const sql = neon(url);
const targetUserId = "9ea9351f-d420-428c-8db7-09d3c59e5013";

async function check() {
    const nurses = await sql`SELECT * FROM nurses WHERE user_id = ${targetUserId}`;
    console.log("Nurses:", nurses);
    if (nurses.length > 0) {
        const orgs = await sql`SELECT * FROM organizations WHERE id = ${nurses[0].org_id}`;
        console.log("Org:", orgs);
        const patients = await sql`SELECT * FROM patients WHERE org_id = ${nurses[0].org_id}`;
        console.log("Patients count:", patients.length);
    }
}

check().catch(console.error).finally(() => process.exit());
