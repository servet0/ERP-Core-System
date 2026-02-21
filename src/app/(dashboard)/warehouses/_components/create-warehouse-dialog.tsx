"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { createWarehouse, type FormState } from "../_actions/actions";

const initialState: FormState = { success: false };

export function CreateWarehouseDialog() {
    const [open, setOpen] = useState(false);
    const [state, formAction, isPending] = useActionState(createWarehouse, initialState);

    useEffect(() => {
        if (state.success) {
            setOpen(false);
        }
    }, [state.success]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Yeni Depo
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Yeni Depo Ekle</DialogTitle>
                    <DialogDescription>
                        Depo bilgilerini girin. Mevcut tüm ürünler için otomatik stok kaydı açılacaktır.
                    </DialogDescription>
                </DialogHeader>

                <form action={formAction} className="space-y-4">
                    {state.error && !state.fieldErrors && (
                        <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                            {state.error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="name">Depo Adı</Label>
                        <Input id="name" name="name" required placeholder="Ör: Merkez Depo" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="code">Depo Kodu</Label>
                        <Input id="code" name="code" required placeholder="Ör: WH-01" />
                        {state.fieldErrors?.code && (
                            <p className="text-xs text-destructive">{state.fieldErrors.code[0]}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="address">Adres (Opsiyonel)</Label>
                        <Input id="address" name="address" placeholder="Ör: İstanbul, Kadıköy" />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            İptal
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? "Kaydediliyor..." : "Depo Ekle"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
