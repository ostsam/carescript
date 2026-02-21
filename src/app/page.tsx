import React from "react";
import {
	Shield,
	Zap,
	Activity,
	Mic,
	Lock,
	Heart,
	Fingerprint,
	CloudOff,
	ArrowRight,
	Play,
	Check,
} from "lucide-react";
import "./landing.css";

export default function LandingPage() {
	return (
		<div className="landing-wrap">
			{/* Navigation */}
			<nav className="nav">
				<div className="nav-inner">
					<div className="nav-logo">CareScript</div>
					<div className="nav-links">
						<a href="#vision">Vision</a>
						<a href="#capabilities">Capabilities</a>
						<a href="#security">Privacy</a>
					</div>
				</div>
			</nav>

			{/* Hero Section */}
			<header className="hero">
				<div className="hero-glow"></div>
				<div className="hero-content">
					<div className="hero-eyebrow">CareScript · For Clinical Teams</div>
					<h1 className="h1">
						Care without <br />
						<span className="h1-serif">compromise.</span>
					</h1>
					<p className="p-lead">
						The world’s first dual-state operating system. <br />
						Bridging clinical efficiency and human connection.
					</p>
					<div className="hero-actions">
						<button className="btn-primary">Request Access</button>
					</div>
				</div>
			</header>

			{/* Vision Statement */}
			<section className="section-vision" id="vision">
				<div className="vision-container">
					<h2 className="h2 centered">
						Designed for the <br />
						defining moments of care.
					</h2>
					<p className="p-body centered-text">
						In the quiet moments, CareScript is an invisible scribe, documenting
						every clinical detail. In the critical moments, it becomes a
						familiar voice, de-escalating distress with the comfort of family.
					</p>
				</div>
			</section>

			{/* The Bento Grid - Refined Layout */}
			<section className="section-grid" id="capabilities">
				<div className="bento-grid">
					{/* Card 1: Ambient Scribe (Wide, Light) */}
					<div className="bento-card wide light-card">
						<div className="card-top">
							<div className="icon-box">
								<Mic size={28} strokeWidth={1.5} />
							</div>
							<h3 className="h3">The Ambient Scribe.</h3>
						</div>
						<div className="card-bottom">
							<p className="p-card">
								CareScript listens passively during routine rounds, extracting
								vital signs, observations, and care plans. It turns conversation
								into compliant clinical documentation, instantly.
							</p>
							<div className="feature-tags">
								<span className="tag">Automated Charting</span>
								<span className="tag">Fact Extraction</span>
								<span className="tag">Zero Data Entry</span>
							</div>
						</div>
					</div>

					{/* Card 2: Speed (Square, Light) */}
					<div className="bento-card square light-card">
						<div className="card-top">
							<div className="icon-box blue">
								<Zap size={28} strokeWidth={1.5} />
							</div>
						</div>
						<div className="card-bottom">
							<h3 className="h4">Instant Response.</h3>
							<p className="p-small">
								Latency so low, it feels like a natural conversation. Engineered
								for the edge.
							</p>
						</div>
					</div>

					{/* Card 3: Security (Square, Light) */}
					<div className="bento-card square light-card">
						<div className="card-top">
							<div className="icon-box green">
								<Shield size={28} strokeWidth={1.5} />
							</div>
						</div>
						<div className="card-bottom">
							<h3 className="h4">Aegis Shield™.</h3>
							<p className="p-small">
								Identity masking ensures names never leave the device. HIPAA
								Compliant by default.
							</p>
						</div>
					</div>

					{/* Card 4: Intervention (Wide, Dark) */}
					<div className="bento-card wide dark-card">
						<div className="card-bg-glow"></div>
						<div className="card-content-relative">
							<div className="card-top">
								<div className="icon-box white">
									<Heart size={28} strokeWidth={1.5} />
								</div>
								<h3 className="h3 text-white">Active Intervention.</h3>
							</div>
							<div className="card-bottom">
								<p className="p-card text-white-alpha">
									When agitation rises, the system translates clinical
									instructions into the comforting, cloned voice of a loved one.
								</p>
								<div className="feature-tags">
									<span className="tag dark">Voice Cloning</span>
									<span className="tag dark">Crisis De-escalation</span>
									<span className="tag dark">Emotional Intelligence</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Privacy / Pipeline Section - Redesigned */}
			<section className="section-privacy" id="security">
				<div className="privacy-header">
					<div className="label-text">Privacy Architecture</div>
					<h2 className="h2">Zero-Trust. By Default.</h2>
					<p className="p-body">
						Patient data is sacred. Our proprietary isolation pipeline sanitizes
						information <br /> before it ever touches the cloud.
					</p>
				</div>

				<div className="pipeline-visual">
					<div className="pipeline-card">
						<div className="step-badge">01</div>
						<h4 className="h5">Voice Input</h4>
						<p className="p-tiny">Audio is captured locally on the device.</p>
					</div>
					<div className="connector"></div>
					<div className="pipeline-card active">
						<div className="step-badge blue">
							<Check size={16} strokeWidth={3} />
						</div>
						<h4 className="h5">Local Redaction</h4>
						<p className="p-tiny">PII is stripped via on-device ML models.</p>
					</div>
					<div className="connector"></div>
					<div className="pipeline-card">
						<div className="step-badge">03</div>
						<h4 className="h5">Encrypted Cloud</h4>
						<p className="p-tiny">Only anonymized tokens leave the facility.</p>
					</div>
				</div>
			</section>

			{/* Minimal Footer */}
			<footer className="footer">
				<div className="footer-logo">CareScript</div>
				<div className="footer-links">
					<a href="#">Company</a>
					<a href="#">Platform</a>
					<a href="#">Legal</a>
					<a href="#">Contact</a>
				</div>
				<p className="copyright">© 2026 CareScript Inc. All rights reserved.</p>
			</footer>
		</div>
	);
}
