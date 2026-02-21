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
import { createProduct, type FormState } from "../_actions/actions";

const initialState: FormState = { success: false };

export function CreateProductDialog() {
    const [open, setOpen] = useState(false);
    const [state, formAction, isPending] = useActionState(createProduct, initialState);

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
                    Yeni Ürün
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Yeni Ürün Ekle</DialogTitle>
                    <DialogDescription>
                        Ürün bilgilerini girin. Tüm depolarda otomatik stok kaydı oluşturulacaktır.
                    </DialogDescription>
                </DialogHeader>

                <form action={formAction} className="space-y-4">
                    {state.error && !state.fieldErrors && (
                        <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                            {state.error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="name">Ürün Adı</Label>
                        <Input id="name" name="name" required placeholder="Ör: Akıllı Telefon X12" />
                        {state.fieldErrors?.name && (
                            <p className="text-xs text-destructive">{state.fieldErrors.name[0]}</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="sku">Stok Kodu (SKU)</Label>
                            <Input id="sku" name="sku" required placeholder="Ör: TEL-X12" />
                            {state.fieldErrors?.sku && (
                                <p className="text-xs text-destructive">{state.fieldErrors.sku[0]}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="price">Fiyat (₺)</Label>
                            <Input id="price" name="price" type="number" step="0.01" min="0" defaultValue="0" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="unit">Birim</Label>
                            <Input id="unit" name="unit" defaultValue="ADET" placeholder="ADET, KG, LT" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="minStock">Min. Stok</Label>
                            <Input id="minStock" name="minStock" type="number" min="0" defaultValue="0" />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            İptal
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? "Kaydediliyor..." : "Ürün Ekle"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
