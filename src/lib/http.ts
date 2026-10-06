import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

const statusByMessage: Record<string, { status: number; label: string }> = {
  UNAUTHORIZED: { status: 401, label: "Non authentifié" },
  FORBIDDEN: { status: 403, label: "Accès interdit" },
  NO_TOKENS: { status: 400, label: "Aucun jeton disponible" },
  SESSION_ALREADY_ACTIVE: { status: 409, label: "Une session Internet est déjà active" },
  NO_CONFIGURED_DEVICES: { status: 400, label: "Aucun appareil correctement configuré" },
  INVALID_MAC: { status: 400, label: "Adresse MAC invalide" },
  INVALID_IPV4: { status: 400, label: "Adresse IPv4 invalide" },
  DEVICE_OUTSIDE_CHILD_SUBNET: { status: 400, label: "L'appareil n'est pas dans le réseau enfants" },
  DUPLICATE_DEVICE: { status: 409, label: "Cette IP ou cette adresse MAC est déjà associée à un appareil" },
  TASK_NOT_CLAIMABLE: { status: 409, label: "Cette mission ne peut plus être déclarée terminée" },
  TASK_NOT_CLAIMED: { status: 409, label: "Cette mission a déjà été traitée" },
  NEGATIVE_BALANCE: { status: 400, label: "Solde de jetons insuffisant" },
  ROUTER_DISABLED: { status: 503, label: "Le contrôle MikroTik est désactivé" },
  ROUTER_CONFIG_ERROR: { status: 500, label: "Configuration MikroTik incomplète" },
  ROUTER_TIMEOUT: { status: 504, label: "Le routeur MikroTik ne répond pas" },
  ROUTER_ERROR: { status: 502, label: "Le routeur MikroTik a refusé l'opération" },
  LEASE_NOT_FOUND: { status: 404, label: "Bail DHCP introuvable" },
  CHILD_NOT_FOUND: { status: 404, label: "Enfant introuvable" },
};

export function apiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: error.issues[0]?.message || "Données invalides" },
      { status: 400 },
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json({ error: "Cette valeur existe déjà" }, { status: 409 });
  }

  const message = error instanceof Error ? error.message : "UNKNOWN";
  const mapped = statusByMessage[message];
  if (mapped) return NextResponse.json({ error: mapped.label }, { status: mapped.status });

  console.error("Unhandled API error", error);
  return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
}
