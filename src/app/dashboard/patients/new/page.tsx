import { auth } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { PatientOnboarding } from "./patient-onboarding";

export default async function NewPatientPage() {
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  return (
    <>
      <div className="pt-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/dashboard/patients">
            <HugeiconsIcon icon={ArrowLeft01Icon} data-icon="inline-start" />
            All Patients
          </Link>
        </Button>
      </div>
      <PatientOnboarding />
    </>
  );
}
