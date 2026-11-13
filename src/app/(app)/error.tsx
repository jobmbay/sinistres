"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Bouton } from "@/components/ui";

export default function ErreurApplication({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="carte mx-auto mt-10 max-w-lg p-8 text-center" role="alert">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-critique/30 bg-critique/10 text-[#ffb3b1]">
        <TriangleAlert size={22} />
      </span>
      <h1 className="mt-4 text-xl font-medium text-encre">Cette page n'a pas pu s'afficher</h1>
      <p className="mt-2 text-sm leading-relaxed text-encre-3">
        Un problème est survenu pendant le chargement des données. Vos dossiers ne sont pas affectés.
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-encre-3">Référence : {error.digest}</p>}
      <Bouton variante="primaire" className="mt-6" onClick={reset}>
        Réessayer
      </Bouton>
    </div>
  );
}
