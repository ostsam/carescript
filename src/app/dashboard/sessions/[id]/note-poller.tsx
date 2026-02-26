"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function NotePoller() {
    const router = useRouter();

    useEffect(() => {
        const interval = setInterval(() => {
            router.refresh();
        }, 3000); // Polling every 3 seconds

        return () => clearInterval(interval);
    }, [router]);

    return null;
}
