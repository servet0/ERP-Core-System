// ─────────────────────────────────────────────────────────────────
// Soft Delete Helper
// ─────────────────────────────────────────────────────────────────
// Neden service-level (Prisma middleware değil)?
//   1. Açıklık: Her sorguda `deletedAt: null` görünür → debug kolay
//   2. Güvenlik: ERP'de gizli davranış (implicit filtering) tehlikelidir
//   3. Esneklik: Gerektiğinde silinmiş kayıtlar da sorgulanabilir
//   4. Prisma v6+ middleware deprecation yönelimi
// ─────────────────────────────────────────────────────────────────

/**
 * Prisma where clause'a `deletedAt: null` ekler.
 * Soft-deleted kayıtları otomatik filtreler.
 *
 * @example
 * const where = excludeDeleted({ active: true });
 * // → { active: true, deletedAt: null }
 */
export function excludeDeleted<T extends Record<string, unknown>>(
    where: T
): T & { deletedAt: null } {
    return { ...where, deletedAt: null };
}
