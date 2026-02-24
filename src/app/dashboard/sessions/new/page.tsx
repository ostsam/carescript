import { auth } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { getPatientList } from "../actions";
import { NewSessionFlow } from "./new-session-flow";

interface Props {
  searchParams: Promise<{ patientId?: string }>;
}

export default async function NewSessionPage({ searchParams }: Props) {
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const params = await searchParams;
  const patients = await getPatientList();

  return (
    <NewSessionFlow
      patients={patients}
      defaultPatientId={params.patientId}
    />
  );
}
