export default function ChargementSuivi() {
  return (
    <div aria-busy="true" aria-label="Chargement de votre dossier" className="mx-auto w-full max-w-2xl flex-1 animate-pulse px-4 pt-10">
      <div className="mb-6 h-9 w-56 rounded-lg bg-white/[0.06]" />
      <div className="carte h-72" />
      <div className="carte mt-4 h-48" />
    </div>
  );
}
