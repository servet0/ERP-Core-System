"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Package, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ── Validation Schema ──
const loginSchema = z.object({
    email: z.string().email("Geçerli bir e-posta adresi girin"),
    password: z.string().min(1, "Şifre gerekli"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// ── Login Page ──
export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") || "/";
    const [error, setError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: { email: "", password: "" },
    });

    async function onSubmit(data: LoginFormValues) {
        setError(null);

        try {
            const result = await signIn("credentials", {
                email: data.email.toLowerCase().trim(),
                password: data.password,
                redirect: false,
            });

            if (result?.error) {
                setError("E-posta veya şifre hatalı.");
                return;
            }

            router.push(callbackUrl);
            router.refresh();
        } catch {
            setError("Bir hata oluştu. Lütfen tekrar deneyin.");
        }
    }

    return (
        <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-12">
            {/* ── Brand ── */}
            <div className="mb-8 flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <Package className="h-5 w-5" />
                </div>
                <div>
                    <h1 className="text-lg font-semibold leading-none">ERP Core</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Stok & Satış Yönetimi
                    </p>
                </div>
            </div>

            {/* ── Login Card ── */}
            <Card className="w-full max-w-md rounded-2xl shadow-lg border">
                <CardHeader className="text-center pb-2">
                    <CardTitle className="text-xl">Giriş Yap</CardTitle>
                    <CardDescription>
                        Devam etmek için hesabınıza giriş yapın
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        {/* Error Alert */}
                        {error && (
                            <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Email */}
                        <div className="space-y-2">
                            <Label htmlFor="email">E-posta</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="ornek@sirket.com"
                                autoComplete="email"
                                autoFocus
                                {...register("email")}
                            />
                            {errors.email && (
                                <p className="text-xs text-destructive">
                                    {errors.email.message}
                                </p>
                            )}
                        </div>

                        {/* Password */}
                        <div className="space-y-2">
                            <Label htmlFor="password">Şifre</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                autoComplete="current-password"
                                {...register("password")}
                            />
                            {errors.password && (
                                <p className="text-xs text-destructive">
                                    {errors.password.message}
                                </p>
                            )}
                        </div>

                        {/* Submit */}
                        <Button
                            type="submit"
                            className="w-full"
                            disabled={isSubmitting}
                        >
                            {isSubmitting && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Giriş Yap
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* ── Footer ── */}
            <p className="mt-8 text-xs text-muted-foreground">
                © {new Date().getFullYear()} ERP Core System
            </p>
        </div>
    );
}
