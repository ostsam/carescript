"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ChangePasswordForm() {
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [isPending, setIsPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setSuccess(false);

		if (newPassword.length < 8) {
			setError("New password must be at least 8 characters.");
			return;
		}

		if (newPassword !== confirmPassword) {
			setError("New passwords do not match.");
			return;
		}

		setIsPending(true);

		const { error: apiError } = await authClient.changePassword({
			currentPassword,
			newPassword,
			revokeOtherSessions: true,
		});

		setIsPending(false);

		if (apiError) {
			setError(apiError.message ?? "Failed to change password.");
			return;
		}

		setSuccess(true);
		setCurrentPassword("");
		setNewPassword("");
		setConfirmPassword("");
	}

	return (
		<form onSubmit={handleSubmit} className="max-w-xs flex flex-col gap-4">
			<div className="space-y-1.5">
				<label
					htmlFor="current-password"
					className="text-sm text-muted-foreground"
				>
					Current password
				</label>
				<Input
					id="current-password"
					type="password"
					autoComplete="current-password"
					required
					value={currentPassword}
					onChange={(e) => setCurrentPassword(e.target.value)}
				/>
			</div>

			<div className="space-y-1.5">
				<label htmlFor="new-password" className="text-sm text-muted-foreground">
					New password
				</label>
				<Input
					id="new-password"
					type="password"
					autoComplete="new-password"
					required
					minLength={8}
					value={newPassword}
					onChange={(e) => setNewPassword(e.target.value)}
				/>
			</div>

			<div className="space-y-1.5">
				<label
					htmlFor="confirm-password"
					className="text-sm text-muted-foreground"
				>
					Confirm new password
				</label>
				<Input
					id="confirm-password"
					type="password"
					autoComplete="new-password"
					required
					minLength={8}
					value={confirmPassword}
					onChange={(e) => setConfirmPassword(e.target.value)}
				/>
			</div>

			{error && <p className="text-sm text-destructive">{error}</p>}
			{success && (
				<p className="text-sm text-emerald-600">
					Password updated successfully.
				</p>
			)}

			<Button type="submit" disabled={isPending}>
				{isPending ? "Updating…" : "Update password"}
			</Button>
		</form>
	);
}
