/**
 * Çaykur producer identifiers (ruhsat / cüzdan no) with a stable fallback for
 * accounts the registry has not filled in yet. The fallback is a 6-digit
 * number derived from the user id, so the same user always sees the same
 * placeholder instead of a value that changes on every reload.
 */
function placeholderNumber(key: string): string {
    let hash = 0;
    for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return String(100_000 + (hash % 900_000));
}

interface CaykurIdentitySource {
    id?: string | null;
    ruhsatNo?: string | null;
    cuzdanNo?: string | null;
}

export function resolveRuhsatNo(user: CaykurIdentitySource | null | undefined): string {
    return user?.ruhsatNo?.trim() || placeholderNumber(`ruhsat:${user?.id ?? ''}`);
}

export function resolveCuzdanNo(user: CaykurIdentitySource | null | undefined): string {
    return user?.cuzdanNo?.trim() || placeholderNumber(`cuzdan:${user?.id ?? ''}`);
}
