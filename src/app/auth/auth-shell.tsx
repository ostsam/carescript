"use client";

import Link from "next/link";
import "./auth.css";

type AuthShellProps = {
	variant: "sign-in" | "sign-up" | "forgot-password";
	children: React.ReactNode;
};

const copy = {
	"sign-in": {
		eyebrow: "Clinical Access Portal",
		title: "Welcome back to",
		emphasis: "CareScript.",
		subtitle:
			"Continue where clinical precision meets human connection with a secure sign-in.",
	},
	"sign-up": {
		eyebrow: "New Clinician Access",
		title: "Start with",
		emphasis: "CareScript.",
		subtitle:
			"Set up your clinical workspace in minutes with privacy-first defaults.",
		panelLabel: "Create Account",
		panelNote: "Protected by Aegis Shield. Privacy-first by design.",
		quote: "Built for the defining moments of care.",
	},
	"forgot-password": {
		eyebrow: "Account Recovery",
		title: "Reset your",
		emphasis: "password.",
		subtitle:
			"Enter your email and we'll send you a link to regain access to your clinical workspace.",
	},
};

export function AuthShell({ variant, children }: AuthShellProps) {
	const content = copy[variant];

	return (
		<div className={`auth-shell auth-${variant}`}>
			<nav className="auth-nav">
				<div className="auth-nav-inner">
					<Link className="auth-logo" href="/">
						CareScript
					</Link>
					<div className="auth-nav-links">
						<Link href="/#vision">Vision</Link>
						<Link href="/#security">Privacy</Link>
						<Link className="auth-nav-cta" href="/">
							Home
						</Link>
					</div>
				</div>
			</nav>

			<main className="auth-grid">
				<section className="auth-hero">
					<div className="auth-eyebrow">{content.eyebrow}</div>
					<h1 className="auth-title">
						{content.title}
						<br />
						<span className="auth-title-serif">{content.emphasis}</span>
					</h1>
					<p className="auth-subtitle">{content.subtitle}</p>
				</section>

				<section className="auth-panel">
					<div className="auth-panel-inner">{children}</div>
				</section>
			</main>

			<footer className="auth-footer">
				Copyright 2026 CareScript Inc. All rights reserved.
			</footer>
		</div>
	);
}
