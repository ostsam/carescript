import * as dotenv from "dotenv";
dotenv.config();

import { db } from "../src/lib/db";
import { nurses, organizations, patients } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

const targetUserId = "9ea9351f-d420-428c-8db7-09d3c59e5013";

async function auditData() {
    console.log(`🔍 Auditing data for UserId: ${targetUserId}...`);

    const nurseRecord = await db.select().from(nurses).where(eq(nurses.userId, targetUserId));

    if (nurseRecord.length === 0) {
        console.error("❌ ERROR: Nurse record is MISSING!");
    } else {
        console.log("✅ Nurse Record Found:", nurseRecord[0]);
        const orgId = nurseRecord[0].orgId;
        const orgRecord = await db.select().from(organizations).where(eq(organizations.id, orgId));
        if (orgRecord.length === 0) {
            console.error(`❌ ERROR: Organization ${orgId} is MISSING!`);
        } else {
            console.log("✅ Organization Validated:", orgRecord[0].name);
        }

        const patientRecords = await db.select().from(patients).where(eq(patients.orgId, orgId));
        console.log(`✅ Patients Found for Org: ${patientRecords.length}`);
        if (patientRecords.length === 0) {
            console.warn("⚠️ WARNING: No patients found for this organization. You won't be able to start a session.");
        } else {
            patientRecords.forEach(p => console.log(`   - ${p.patientFirstName} ${p.patientLastName}`));
        }
    }
}

auditData().catch(console.error).finally(() => process.exit());
