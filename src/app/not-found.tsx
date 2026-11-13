import Link from "next/link";
import { Compass } from "lucide-react";
import { Embleme } from "@/components/logo";
import { classesBouton } from "@/components/ui";

export default function PageIntrouvable() {
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-16">
      <div className="carte w-full max-w-md p-8 text-center">
        <Embleme taille={44} className="mx-auto" />
        <span className="mx-auto mt-6 grid h-12 w-12 place-items-center rounded-2xl border border-trait bg-white/[0.04] text-encre-3">
          <Compass size={22} />
        </span>
        <h1 className="mt-4 text-xl font-medium text-encre">Page introuvable</h1>
        <p className="mt-2 text-sm leading-relaxed text-encre-3">
          Cette page n'existe pas, ou vous n'avez pas accès à ce dossier.
        </p>
        <Link href="/tableau-de-bord" className={classesBouton("primaire", "md", "mt-6")}>
          Revenir au tableau de bord
        </Link>
      </div>
    </main>
  );
}
