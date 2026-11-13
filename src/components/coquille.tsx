"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  FolderOpen,
  Scale,
  ChartNoAxesColumn,
  Building2,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Plus,
} from "lucide-react";
import { deconnexion } from "@/actions/auth";
import { Logo } from "./logo";
import { Avatar, cx } from "./ui";

const ICONES = {
  tableau: LayoutDashboard,
  sinistres: FolderOpen,
  recours: Scale,
  rapports: ChartNoAxesColumn,
  compagnies: Building2,
  equipe: Users,
  parametres: Settings,
};

export type EntreeNavigation = { href: string; libelle: string; icone: keyof typeof ICONES; compteur?: number };

export function BarreLaterale({
  entrees,
  utilisateur,
  peutDeclarer,
}: {
  entrees: EntreeNavigation[];
  utilisateur: { nom: string; initiales: string; role: string; compagnie: string };
  peutDeclarer: boolean;
}) {
  const chemin = usePathname();
  const [ouvert, setOuvert] = useState(false);

  const contenu = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 pt-6 pb-5">
        <Link href="/tableau-de-bord" aria-label="Accueil">
          <Logo />
        </Link>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          aria-label="Fermer le menu"
          className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg text-encre-3 hover:bg-white/10 lg:hidden"
        >
          <X size={18} />
        </button>
      </div>

      {peutDeclarer && (
        <div className="px-4 pb-4">
          <Link
            href="/sinistres/nouveau"
            onClick={() => setOuvert(false)}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-or/50 bg-or/[0.07] text-[0.92rem] font-medium text-or-clair transition hover:border-or hover:bg-or/15"
          >
            <Plus size={17} /> Déclarer un sinistre
          </Link>
        </div>
      )}

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="Navigation principale">
        {entrees.map((entree) => {
          const Icone = ICONES[entree.icone];
          const actif = chemin === entree.href || chemin.startsWith(`${entree.href}/`);
          return (
            <Link
              key={entree.href}
              href={entree.href}
              onClick={() => setOuvert(false)}
              aria-current={actif ? "page" : undefined}
              className={cx(
                "group relative flex h-11 items-center gap-3 rounded-xl px-3 text-[0.93rem] transition",
                actif ? "bg-white/[0.07] text-encre" : "text-encre-3 hover:bg-white/[0.04] hover:text-encre-2",
              )}
            >
              {actif && <span aria-hidden className="absolute top-2.5 bottom-2.5 left-0 w-[3px] rounded-full bg-or" />}
              <Icone size={18} className={actif ? "text-or" : "text-encre-3 group-hover:text-encre-2"} strokeWidth={1.8} />
              <span className="flex-1">{entree.libelle}</span>
              {entree.compteur !== undefined && entree.compteur > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-or/20 px-1.5 text-[0.68rem] font-medium text-or-clair">
                  {entree.compteur}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-trait p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <Avatar texte={utilisateur.initiales} ton="or" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium text-encre">{utilisateur.nom}</p>
            <p className="truncate text-xs text-encre-3">
              {utilisateur.role} · {utilisateur.compagnie}
            </p>
          </div>
          <form action={deconnexion}>
            <button
              type="submit"
              title="Se déconnecter"
              aria-label="Se déconnecter"
              className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg text-encre-3 transition hover:bg-white/10 hover:text-encre"
            >
              <LogOut size={17} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Barre supérieure mobile */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-trait bg-fond/85 px-4 backdrop-blur-md lg:hidden">
        <Link href="/tableau-de-bord" aria-label="Accueil">
          <Logo />
        </Link>
        <button
          type="button"
          onClick={() => setOuvert(true)}
          aria-label="Ouvrir le menu"
          className="grid h-10 w-10 cursor-pointer place-items-center rounded-lg text-encre-2 hover:bg-white/10"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Tiroir mobile */}
      {ouvert && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOuvert(false)} aria-hidden />
          <aside className="animate-apparition absolute inset-y-0 left-0 w-[17.5rem] border-r border-trait bg-[#06110f]">
            {contenu}
          </aside>
        </div>
      )}

      {/* Barre latérale (bureau) */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-trait bg-black/25 backdrop-blur-xl lg:block">
        {contenu}
      </aside>
    </>
  );
}

export function SqueletteBarreLaterale() {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-trait bg-black/25 lg:block" aria-hidden>
      <div className="px-5 pt-6">
        <Logo />
      </div>
      <div className="mt-8 space-y-2 px-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-xl bg-white/[0.04]" />
        ))}
      </div>
    </aside>
  );
}
