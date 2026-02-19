// ─────────────────────────────────────────────────────────────────
// Product Service — İş Mantığı Katmanı (Phase 7A: Org-Scoped)
// ─────────────────────────────────────────────────────────────────

import prisma from "@/lib/prisma";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { excludeDeleted } from "@/lib/soft-delete";
import type { CreateProductInput, UpdateProductInput, ProductFilterInput } from "@/schemas/product.schema";
import type { PaginatedResult } from "@/types";
import type { Product } from "@prisma/client";

// ─── Ürün Listesi ───
export async function listProducts(
    filter: ProductFilterInput
): Promise<PaginatedResult<Product>> {
    const { page, pageSize, search, active } = filter;
    const skip = (page - 1) * pageSize;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (search) {
        where.OR = [
            { name: { contains: search, mode: "insensitive" } },
            { sku: { contains: search, mode: "insensitive" } },
        ];
    }

    if (active !== undefined) {
        where.active = active;
    }

    const finalWhere = excludeDeleted(where);

    const [products, total] = await Promise.all([
        prisma.product.findMany({
            where: finalWhere,
            orderBy: { createdAt: "desc" },
            skip,
            take: pageSize,
        }),
        prisma.product.count({ where: finalWhere }),
    ]);

    return {
        data: products,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
    };
}

// ─── Ürün Detayı ───
export async function getProductById(id: string): Promise<Product> {
    const product = await prisma.product.findUnique({
        where: { id },
    });

    if (!product) {
        throw new NotFoundError("Ürün bulunamadı");
    }

    return product;
}

// ─── Ürün Oluşturma ───
export async function createProduct(
    organizationId: string,
    input: CreateProductInput
): Promise<Product> {
    // SKU teklik kontrolü (org-scoped)
    const existing = await prisma.product.findUnique({
        where: {
            organizationId_sku: {
                organizationId,
                sku: input.sku,
            },
        },
    });

    if (existing) {
        throw new ValidationError("Bu stok kodu zaten kullanılmaktadır", {
            sku: ["Bu stok kodu zaten kullanılmaktadır"],
        });
    }

    return prisma.product.create({
        data: {
            organizationId,
            sku: input.sku,
            name: input.name,
            description: input.description,
            unit: input.unit,
            price: input.price,
        },
    });
}

// ─── Ürün Güncelleme ───
export async function updateProduct(
    organizationId: string,
    input: UpdateProductInput
): Promise<Product> {
    const existing = await prisma.product.findUnique({
        where: { id: input.id },
    });

    if (!existing) {
        throw new NotFoundError("Ürün bulunamadı");
    }

    // SKU değişiyorsa teklik kontrolü (org-scoped)
    if (input.sku && input.sku !== existing.sku) {
        const skuExists = await prisma.product.findUnique({
            where: {
                organizationId_sku: {
                    organizationId,
                    sku: input.sku,
                },
            },
        });
        if (skuExists) {
            throw new ValidationError("Bu stok kodu zaten kullanılmaktadır", {
                sku: ["Bu stok kodu zaten kullanılmaktadır"],
            });
        }
    }

    const { id, ...updateData } = input;

    return prisma.product.update({
        where: { id },
        data: updateData,
    });
}
