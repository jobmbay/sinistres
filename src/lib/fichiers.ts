import "server-only";
import { randomUUID } from "node:crypto";
import { ErreurMetier } from "./actions";

export const TAILLE_MAX_FICHIER = 10 * 1024 * 1024;

const TYPES_ACCEPTES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export const FORMATS_ACCEPTES = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx";

export function controlerFichier(fichier: File) {
  if (fichier.size === 0) throw new ErreurMetier("Choisissez un fichier à déposer.");
  if (fichier.size > TAILLE_MAX_FICHIER) throw new ErreurMetier("Le fichier dépasse la taille maximale de 10 Mo.");
  if (!TYPES_ACCEPTES.has(fichier.type)) {
    throw new ErreurMetier("Format non accepté. Déposez un PDF, une photo (JPG, PNG) ou un document Word ou Excel.");
  }
}

/** Chemin de stockage : <dossier>/<identifiant aléatoire>-<nom nettoyé> */
export function cheminDePiece(sinistreId: string, nomFichier: string) {
  const propre = nomFichier
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(-80);
  return `${sinistreId}/${randomUUID()}-${propre}`;
}
