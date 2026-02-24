import { auth } from "@/lib/auth/server";
import { withAuth } from "@/lib/db";
import { nurses, organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { ChangePasswordForm } from "./change-password-form";

export default async function SettingsPage() {
	const { data: session } = await auth.getSession();

	if (!session?.user) {
		redirect("/auth/sign-in");
	}

	const profile = await withAuth(session.user.id, async (tx) => {
		const rows = await tx
			.select({
				nurseFirstName: nurses.nurseFirstName,
				nurseLastName: nurses.nurseLastName,
				orgName: organizations.name,
				memberSince: nurses.createdAt,
			})
			.from(nurses)
			.innerJoin(organizations, eq(nurses.orgId, organizations.id))
			.where(eq(nurses.userId, session.user.id))
			.limit(1);

		return rows[0] ?? null;
	});

	const fullName = profile
		? `${profile.nurseFirstName} ${profile.nurseLastName}`
		: session.user.name ?? "—";

	const memberSince = profile?.memberSince
		? profile.memberSince.toLocaleDateString("en-US", {
				month: "long",
				year: "numeric",
			})
		: "—";

	return (
		<div className="mx-auto w-full max-w-2xl py-6">
			<div className="mb-8">
				<h1 className="text-xl font-semibold tracking-tight">Settings</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Manage your account and preferences.
				</p>
			</div>

			<Separator />

			<section className="py-6">
				<h2 className="text-sm font-semibold">Profile</h2>
				<p className="mt-0.5 text-sm text-muted-foreground">
					Your personal information.
				</p>
				<dl className="mt-4 space-y-3">
					<InfoRow label="Full name" value={fullName} />
					<InfoRow label="Email" value={session.user.email} />
				</dl>
			</section>

			<Separator />

			<section className="py-6">
				<h2 className="text-sm font-semibold">Organization</h2>
				<p className="mt-0.5 text-sm text-muted-foreground">
					Your organization details.
				</p>
				<dl className="mt-4 space-y-3">
					<InfoRow label="Organization" value={profile?.orgName ?? "—"} />
					<InfoRow label="Member since" value={memberSince} />
				</dl>
			</section>

			<Separator />

			<section className="py-6">
				<h2 className="text-sm font-semibold">Security</h2>
				<p className="mt-0.5 text-sm text-muted-foreground">
					Update your password.
				</p>
				<div className="mt-4">
					<ChangePasswordForm />
				</div>
			</section>
		</div>
	);
}

function InfoRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-baseline gap-4">
			<dt className="w-32 shrink-0 text-sm text-muted-foreground">
				{label}
			</dt>
			<dd className="text-sm">{value}</dd>
		</div>
	);
}
