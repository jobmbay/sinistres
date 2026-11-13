/**
 * Ossature affichée pendant le chargement d'une page de l'application.
 *
 * Chaque dossier de route possède son propre loading.tsx qui la réexporte :
 * la frontière de chargement doit se trouver sous la disposition partagée
 * pour que le passage d'une page à l'autre réagisse instantanément.
 */
export default function Chargement() {
  return (
    <div aria-busy="true" aria-label="Chargement" className="animate-pulse">
      <div className="mb-6">
        <div className="h-8 w-64 rounded-lg bg-white/[0.06]" />
        <div className="mt-3 h-4 w-96 max-w-full rounded bg-white/[0.04]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="carte h-28" />
        ))}
      </div>
      <div className="carte mt-4 h-96" />
    </div>
  );
}
