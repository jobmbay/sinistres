import { LinkIcon } from "lucide-react";
import { Embleme } from "@/components/logo";

export default function SuiviIntrouvable() {
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-16">
      <div className="carte w-full max-w-md p-8 text-center">
        <Embleme taille={44} className="mx-auto" />
        <span className="mx-auto mt-6 grid h-12 w-12 place-items-center rounded-2xl border border-trait bg-white/[0.04] text-encre-3">
          <LinkIcon size={22} />
        </span>
        <h1 className="mt-4 text-xl font-medium text-encre">Lien de suivi introuvable</h1>
        <p className="mt-2 text-sm leading-relaxed text-encre-3">
          Ce lien est incomplet ou n'est plus valide. Vérifiez que vous avez copié l'adresse en entier, ou demandez à
          votre gestionnaire de vous renvoyer votre lien de suivi.
        </p>
      </div>
    </main>
  );
}
