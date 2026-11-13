"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy, ExternalLink, Mail, MessageCircle, Smartphone } from "lucide-react";
import { classesBouton, cx } from "@/components/ui";

/**
 * Lien de suivi de l'assuré : copie et envoi en un geste par WhatsApp,
 * e-mail ou SMS (depuis l'appareil de l'agent, sans service tiers).
 */
export function PartageSuivi({
  jeton,
  numero,
  assureNom,
  telephone,
  email,
  compagnie,
}: {
  jeton: string;
  numero: string;
  assureNom: string;
  telephone: string | null;
  email: string | null;
  compagnie: string;
}) {
  // Adresse du site : connue seulement dans le navigateur (vide pendant le rendu serveur).
  const origine = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const [copie, setCopie] = useState(false);

  const lien = `${origine}/suivi/${jeton}`;
  const message =
    `Bonjour ${assureNom}, votre sinistre n° ${numero} est enregistré chez ${compagnie}. ` +
    `Suivez son avancement et déposez vos pièces ici : ${lien}`;
  const chiffres = (telephone ?? "").replace(/\D/g, "");

  const canaux = [
    {
      libelle: "WhatsApp",
      icone: MessageCircle,
      href: `https://wa.me/${chiffres}?text=${encodeURIComponent(message)}`,
      aide: chiffres ? `Envoyer au ${telephone}` : "Choisir le contact dans WhatsApp",
      actif: true,
    },
    {
      libelle: "E-mail",
      icone: Mail,
      href: `mailto:${email ?? ""}?subject=${encodeURIComponent(`Suivi de votre sinistre n° ${numero}`)}&body=${encodeURIComponent(message)}`,
      aide: email ? `Envoyer à ${email}` : "Aucune adresse e-mail enregistrée",
      actif: Boolean(email),
    },
    {
      libelle: "SMS",
      icone: Smartphone,
      href: `sms:${telephone ?? ""}?&body=${encodeURIComponent(message)}`,
      aide: telephone ? `Envoyer au ${telephone}` : "Aucun téléphone enregistré",
      actif: Boolean(telephone),
    },
  ];

  return (
    <div>
      <div className="flex items-stretch gap-2">
        <div className="flex min-w-0 flex-1 items-center rounded-xl border border-trait-fort bg-black/40 px-3 font-mono text-xs text-encre-2">
          <span className="truncate">{origine ? lien.replace(/^https?:\/\//, "") : `/suivi/${jeton}`}</span>
        </div>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(lien);
            setCopie(true);
            setTimeout(() => setCopie(false), 1800);
          }}
          className={classesBouton(copie ? "secondaire" : "primaire", "sm", "h-10")}
        >
          {copie ? <Check size={15} /> : <Copy size={15} />}
          {copie ? "Copié" : "Copier"}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {canaux.map(({ libelle, icone: Icone, href, aide, actif }) => (
          <a
            key={libelle}
            href={actif ? href : undefined}
            target={libelle === "WhatsApp" ? "_blank" : undefined}
            rel="noreferrer"
            title={aide}
            aria-disabled={!actif}
            className={cx(
              "flex h-16 flex-col items-center justify-center gap-1 rounded-xl border text-xs transition",
              actif
                ? "border-trait-fort bg-white/[0.04] text-encre-2 hover:border-white/25 hover:bg-white/[0.08] hover:text-encre"
                : "cursor-not-allowed border-trait text-encre-3 opacity-50",
            )}
          >
            <Icone size={17} strokeWidth={1.7} />
            {libelle}
          </a>
        ))}
      </div>

      <a
        href={`/suivi/${jeton}`}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 text-xs text-encre-3 transition hover:text-or-clair"
      >
        <ExternalLink size={13} /> Voir la page telle que l'assuré la voit
      </a>
    </div>
  );
}
