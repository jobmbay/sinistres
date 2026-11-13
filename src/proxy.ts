import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Rafraîchit la session Supabase et applique un premier filtre d'accès.
 * Le contrôle des droits lui-même est refait côté serveur, au plus près
 * des données (voir src/lib/session.ts et la RLS).
 */
export async function proxy(request: NextRequest) {
  let reponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (liste) => {
          for (const { name, value } of liste) request.cookies.set(name, value);
          reponse = NextResponse.next({ request });
          for (const { name, value, options } of liste) reponse.cookies.set(name, value, options);
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const connecte = Boolean(data?.claims);
  const chemin = request.nextUrl.pathname;

  const rediriger = (vers: string) => {
    const url = request.nextUrl.clone();
    url.pathname = vers;
    url.search = "";
    const redirection = NextResponse.redirect(url);
    for (const cookie of reponse.cookies.getAll()) redirection.cookies.set(cookie);
    return redirection;
  };

  if (!connecte && chemin !== "/connexion") return rediriger("/connexion");
  if (connecte && (chemin === "/connexion" || chemin === "/")) return rediriger("/tableau-de-bord");
  return reponse;
}

export const config = {
  // Tout sauf : fichiers statiques, images, et l'espace de suivi client (public).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|suivi/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
