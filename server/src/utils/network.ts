import net from 'node:net';

/**
 * Utilidades de direccionamiento para la red local (RFC 1918).
 *
 * RFC 1918 reserva para uso privado:
 *   10.0.0.0/8        (10.0.0.0   – 10.255.255.255)
 *   172.16.0.0/12     (172.16.0.0 – 172.31.255.255)
 *   192.168.0.0/16    (192.168.0.0 – 192.168.255.255)
 *
 * El MVP acepta además loopback (127.0.0.0/8, ::1) para desarrollo local y
 * las direcciones IPv6 de ámbito local (fc00::/7, fe80::/10).
 */
const PRIVATE_IPV4_PATTERNS: readonly RegExp[] = [
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^127\./,
];

export function normalizeIp(ip: string | undefined | null): string | null {
  if (!ip) return null;
  let value = ip.trim();
  if (value.startsWith('::ffff:')) value = value.slice('::ffff:'.length);
  if (value.startsWith('[') && value.endsWith(']')) value = value.slice(1, -1);
  return value.length > 0 ? value : null;
}

export function isPrivateAddress(ip: string | undefined | null): boolean {
  const value = normalizeIp(ip);
  if (!value) return false;
  if (value === 'localhost') return true;

  const version = net.isIP(value);
  if (version === 4) return PRIVATE_IPV4_PATTERNS.some((pattern) => pattern.test(value));
  if (version === 6) {
    const lower = value.toLowerCase();
    return (
      lower === '::1' ||
      lower.startsWith('fc') ||
      lower.startsWith('fd') ||
      lower.startsWith('fe8') ||
      lower.startsWith('fe9') ||
      lower.startsWith('fea') ||
      lower.startsWith('feb')
    );
  }
  return false;
}

/** Extrae el origen (protocolo://host) de un encabezado `Origin`, o `null`. */
export function parseOrigin(origin: string | undefined): string | null {
  if (!origin) return null;
  try {
    const url = new URL(origin);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/** Comprueba si un origen pertenece a la lista blanca configurada. */
export function isAllowedOrigin(
  origin: string | undefined,
  allowedOrigins: readonly string[],
): { allowed: boolean; origin: string | null } {
  const normalized = parseOrigin(origin);
  if (!normalized) return { allowed: false, origin: null };
  const allowed = allowedOrigins.some((candidate) => {
    const parsed = parseOrigin(candidate);
    return parsed !== null && parsed === normalized;
  });
  return { allowed, origin: normalized };
}

/** Dirección base sugerida para los enlaces compartidos dentro de la LAN. */
export function describeNetworkScope(host: string): string {
  if (host === '0.0.0.0' || host === '::') {
    return 'Todas las interfaces disponibles (incluye la red local privada RFC 1918).';
  }
  return isPrivateAddress(host)
    ? `Restringido a la dirección privada ${host} (RFC 1918).`
    : `Advertencia: ${host} no pertenece a un rango privado (RFC 1918).`;
}
