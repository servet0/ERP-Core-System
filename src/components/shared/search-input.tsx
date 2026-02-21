"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchInputProps {
    placeholder?: string;
    paramName?: string;
}

export function SearchInput({
    placeholder = "Ara...",
    paramName = "search",
}: SearchInputProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const value = e.target.value;
            const params = new URLSearchParams(searchParams.toString());

            if (value) {
                params.set(paramName, value);
            } else {
                params.delete(paramName);
            }

            startTransition(() => {
                router.replace(`${pathname}?${params.toString()}`);
            });
        },
        [router, pathname, searchParams, paramName]
    );

    return (
        <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
                type="search"
                placeholder={placeholder}
                defaultValue={searchParams.get(paramName) ?? ""}
                onChange={handleChange}
                className={`pl-9 ${isPending ? "opacity-60" : ""}`}
            />
        </div>
    );
}
