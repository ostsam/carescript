"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Stethoscope02Icon,
	Home01Icon,
	PatientIcon,
	Mic01Icon,
	CheckListIcon,
	Logout01Icon,
	Settings01Icon,
	ArrowDown01Icon,
} from "@hugeicons/core-free-icons";
import { authClient } from "@/lib/auth/client";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const clinicalNav = [
	{ title: "Dashboard", url: "/dashboard", icon: Home01Icon },
	{ title: "Patients", url: "/dashboard/patients", icon: PatientIcon },
	{ title: "Sessions", url: "/dashboard/sessions", icon: Mic01Icon },
	{ title: "Review Queue", url: "/dashboard/review", icon: CheckListIcon },
];

type UserInfo = {
	id: string;
	name?: string | null;
	email: string;
};

function getInitials(name?: string | null, email?: string): string {
	if (name) {
		return name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2);
	}
	return (email?.[0] ?? "U").toUpperCase();
}

export function AppSidebar({ user }: { user: UserInfo }) {
	const pathname = usePathname();
	const router = useRouter();

	const handleSignOut = async () => {
		await authClient.signOut();
		router.push("/");
	};

	return (
		<Sidebar variant="inset" collapsible="icon">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" asChild>
							<Link href="/dashboard">
								<div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
									<HugeiconsIcon icon={Stethoscope02Icon} size={18} />
								</div>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-semibold">CareScript</span>
									<span className="truncate text-xs text-muted-foreground">
										Clinical Platform
									</span>
								</div>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Clinical</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{clinicalNav.map((item) => (
								<SidebarMenuItem key={item.title}>
									<SidebarMenuButton
										asChild
										isActive={pathname === item.url}
										tooltip={item.title}
									>
										<Link href={item.url}>
											<HugeiconsIcon icon={item.icon} size={18} />
											<span>{item.title}</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<SidebarMenuButton
									size="lg"
									className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
								>
									<Avatar size="sm">
										<AvatarFallback className="bg-primary/10 text-primary text-xs">
											{getInitials(user.name, user.email)}
										</AvatarFallback>
									</Avatar>
									<div className="grid flex-1 text-left text-sm leading-tight">
										<span className="truncate font-semibold">
											{user.name || "User"}
										</span>
										<span className="truncate text-xs text-muted-foreground">
											{user.email}
										</span>
									</div>
									<HugeiconsIcon
										icon={ArrowDown01Icon}
										size={14}
										className="ml-auto opacity-50"
									/>
								</SidebarMenuButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								side="top"
								className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
								align="start"
							>
								<DropdownMenuItem asChild>
									<Link href="/dashboard/settings">
										<HugeiconsIcon icon={Settings01Icon} size={16} />
										Settings
									</Link>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={handleSignOut}>
									<HugeiconsIcon icon={Logout01Icon} size={16} />
									Sign out
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
