"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
import { createSale, type FormState } from "../_actions/actions";

interface Product {
    id: string;
    name: string;
    sku: string;
    price: number;
}

interface Warehouse {
    id: string;
    name: string;
    code: string;
}

interface SaleItem {
    productId: string;
    quantity: number;
    unitPrice: number;
}

const initialState: FormState = { success: false };

export function CreateSaleDialog({
    products,
    warehouses,
}: {
    products: Product[];
    warehouses: Warehouse[];
}) {
    const [open, setOpen] = useState(false);
    const [state, formAction, isPending] = useActionState(createSale, initialState);
    const [items, setItems] = useState<SaleItem[]>([
        { productId: "", quantity: 1, unitPrice: 0 },
    ]);

    useEffect(() => {
        if (state.success) {
            setOpen(false);
            setItems([{ productId: "", quantity: 1, unitPrice: 0 }]);
        }
    }, [state.success]);

    const addItem = () => {
        setItems((prev) => [...prev, { productId: "", quantity: 1, unitPrice: 0 }]);
    };

    const removeItem = (index: number) => {
        setItems((prev) => prev.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, field: keyof SaleItem, value: string | number) => {
        setItems((prev) => {
            const updated = [...prev];
            if (field === "productId") {
                const product = products.find((p) => p.id === value);
                updated[index] = {
                    ...updated[index],
                    productId: value as string,
                    unitPrice: product ? Number(product.price) : 0,
                };
            } else {
                updated[index] = { ...updated[index], [field]: Number(value) };
            }
            return updated;
        });
    };

    const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Yeni Satış
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Yeni Satış Oluştur</DialogTitle>
                    <DialogDescription>
                        Satış onaylandığında stok otomatik olarak düşürülecektir.
                    </DialogDescription>
                </DialogHeader>

                <form
                    action={(formData) => {
                        formData.set("items", JSON.stringify(items));
                        formAction(formData);
                    }}
                    className="space-y-4"
                >
                    {state.error && (
                        <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                            {state.error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="customerName">Müşteri Adı</Label>
                            <Input
                                id="customerName"
                                name="customerName"
                                required
                                placeholder="Ör: Ahmet Yılmaz"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="warehouseId">Depo</Label>
                            <select
                                id="warehouseId"
                                name="warehouseId"
                                required
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                                <option value="">Depo seçin</option>
                                {warehouses.map((wh) => (
                                    <option key={wh.id} value={wh.id}>
                                        {wh.name} ({wh.code})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="note">Not (Opsiyonel)</Label>
                        <Input id="note" name="note" placeholder="Satış notu..." />
                    </div>

                    {/* ── Sale Items ── */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label>Satış Kalemleri</Label>
                            <Button type="button" variant="outline" size="sm" onClick={addItem}>
                                <Plus className="mr-1 h-3 w-3" />
                                Kalem Ekle
                            </Button>
                        </div>

                        <div className="space-y-2">
                            {items.map((item, i) => (
                                <div key={i} className="flex items-end gap-2 rounded-lg border bg-muted/30 p-3">
                                    <div className="flex-1 space-y-1">
                                        <Label className="text-xs">Ürün</Label>
                                        <select
                                            value={item.productId}
                                            onChange={(e) => updateItem(i, "productId", e.target.value)}
                                            required
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        >
                                            <option value="">Ürün seçin</option>
                                            {products.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name} ({p.sku})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="w-20 space-y-1">
                                        <Label className="text-xs">Miktar</Label>
                                        <Input
                                            type="number"
                                            min="1"
                                            value={item.quantity}
                                            onChange={(e) => updateItem(i, "quantity", e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="w-28 space-y-1">
                                        <Label className="text-xs">Birim Fiyat</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={item.unitPrice}
                                            onChange={(e) => updateItem(i, "unitPrice", e.target.value)}
                                            required
                                        />
                                    </div>
                                    {items.length > 1 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="shrink-0 text-muted-foreground hover:text-destructive"
                                            onClick={() => removeItem(i)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end border-t pt-3">
                            <p className="text-sm font-medium">
                                Toplam:{" "}
                                <span className="text-lg">
                                    {new Intl.NumberFormat("tr-TR", {
                                        style: "currency",
                                        currency: "TRY",
                                    }).format(total)}
                                </span>
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            İptal
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? "Kaydediliyor..." : "Satış Oluştur"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
