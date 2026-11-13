-- =====================================================================
--  AWA Sinistres — référentiel des branches et types de sinistre
--  (modifiable ensuite par le gestionnaire dans Paramètres)
-- =====================================================================

insert into public.branches (code, nom, famille, ordre, pieces_requises) values
  ('AUTO', 'Automobile', 'Automobile', 10, array[
    'Déclaration de sinistre', 'Constat amiable ou procès-verbal', 'Permis de conduire',
    'Carte grise', 'Attestation d''assurance', 'Photos des dommages', 'Devis de réparation']),
  ('INC', 'Incendie et risques annexes', 'Dommages aux biens', 20, array[
    'Déclaration de sinistre', 'Rapport des sapeurs-pompiers', 'État estimatif des pertes',
    'Factures ou justificatifs des biens', 'Photos des dommages']),
  ('MRH', 'Multirisque habitation', 'Dommages aux biens', 30, array[
    'Déclaration de sinistre', 'Photos des dommages', 'Factures ou justificatifs des biens',
    'Devis de remise en état', 'Dépôt de plainte (en cas de vol)']),
  ('MRP', 'Multirisque professionnelle', 'Dommages aux biens', 40, array[
    'Déclaration de sinistre', 'État estimatif des pertes', 'Factures ou justificatifs des biens',
    'Photos des dommages', 'Registre de commerce']),
  ('RT', 'Risques techniques', 'Dommages aux biens', 50, array[
    'Déclaration de sinistre', 'Rapport technique', 'Devis de réparation ou de remplacement',
    'Photos des dommages', 'Contrat ou marché concerné']),
  ('AGRI', 'Assurance agricole', 'Dommages aux biens', 60, array[
    'Déclaration de sinistre', 'Certificat vétérinaire ou rapport agronomique', 'Photos',
    'Justificatif de propriété']),
  ('RC', 'Responsabilité civile', 'Responsabilité civile', 70, array[
    'Déclaration de sinistre', 'Réclamation du tiers lésé', 'Justificatifs du préjudice',
    'Témoignages ou procès-verbal']),
  ('CAUT', 'Crédit et caution', 'Responsabilité civile', 80, array[
    'Déclaration de sinistre', 'Contrat garanti', 'Mise en demeure', 'Relevé de créance']),
  ('TRANS', 'Transport', 'Transport', 90, array[
    'Déclaration de sinistre', 'Connaissement ou lettre de voiture', 'Facture commerciale',
    'Liste de colisage', 'Constat d''avarie', 'Réserves au transporteur']),
  ('SANTE', 'Santé', 'Santé et prévoyance', 100, array[
    'Feuille de soins ou demande de prise en charge', 'Ordonnance médicale',
    'Factures acquittées', 'Carte d''assuré']),
  ('IA', 'Individuelle accidents', 'Santé et prévoyance', 110, array[
    'Déclaration d''accident', 'Certificat médical initial', 'Procès-verbal (le cas échéant)',
    'Justificatifs des frais médicaux', 'Pièce d''identité']),
  ('VOY', 'Assistance et voyage', 'Santé et prévoyance', 120, array[
    'Déclaration de sinistre', 'Passeport et titre de transport', 'Rapport médical',
    'Factures acquittées']),
  ('VIE', 'Vie et décès', 'Vie', 130, array[
    'Certificat de décès ou d''invalidité', 'Pièce d''identité du bénéficiaire',
    'Original du contrat', 'Certificat médical', 'Relevé d''identité bancaire'])
on conflict (code) do nothing;

insert into public.types_sinistre (branche_id, nom, ordre)
select b.id, t.nom, t.ordre
  from (values
    ('AUTO', 'Collision avec un tiers', 10),
    ('AUTO', 'Accident corporel', 20),
    ('AUTO', 'Dommages sans tiers identifié', 30),
    ('AUTO', 'Vol du véhicule', 40),
    ('AUTO', 'Incendie du véhicule', 50),
    ('AUTO', 'Bris de glace', 60),
    ('INC', 'Incendie', 10),
    ('INC', 'Explosion', 20),
    ('INC', 'Dommages électriques', 30),
    ('INC', 'Dégât des eaux', 40),
    ('INC', 'Événement naturel', 50),
    ('MRH', 'Dégât des eaux', 10),
    ('MRH', 'Vol ou cambriolage', 20),
    ('MRH', 'Incendie', 30),
    ('MRH', 'Bris de glace', 40),
    ('MRH', 'Responsabilité civile vie privée', 50),
    ('MRP', 'Incendie', 10),
    ('MRP', 'Vol ou cambriolage', 20),
    ('MRP', 'Dégât des eaux', 30),
    ('MRP', 'Perte d''exploitation', 40),
    ('MRP', 'Bris de matériel', 50),
    ('RT', 'Bris de machine', 10),
    ('RT', 'Tous risques chantier', 20),
    ('RT', 'Tous risques montage', 30),
    ('RT', 'Dommages au matériel informatique', 40),
    ('AGRI', 'Mortalité du bétail', 10),
    ('AGRI', 'Perte de récolte', 20),
    ('AGRI', 'Dommages au matériel agricole', 30),
    ('RC', 'Responsabilité civile exploitation', 10),
    ('RC', 'Responsabilité civile professionnelle', 20),
    ('RC', 'Responsabilité civile produits', 30),
    ('RC', 'Responsabilité civile décennale', 40),
    ('CAUT', 'Défaut de paiement', 10),
    ('CAUT', 'Appel de caution', 20),
    ('TRANS', 'Avarie sur marchandises', 10),
    ('TRANS', 'Perte ou manquant', 20),
    ('TRANS', 'Vol en cours de transport', 30),
    ('TRANS', 'Avarie corps de navire', 40),
    ('SANTE', 'Hospitalisation', 10),
    ('SANTE', 'Soins ambulatoires', 20),
    ('SANTE', 'Pharmacie', 30),
    ('SANTE', 'Optique et dentaire', 40),
    ('SANTE', 'Maternité', 50),
    ('SANTE', 'Évacuation sanitaire', 60),
    ('IA', 'Décès accidentel', 10),
    ('IA', 'Invalidité permanente', 20),
    ('IA', 'Incapacité temporaire', 30),
    ('IA', 'Frais médicaux', 40),
    ('VOY', 'Assistance médicale', 10),
    ('VOY', 'Rapatriement', 20),
    ('VOY', 'Annulation de voyage', 30),
    ('VOY', 'Perte de bagages', 40),
    ('VIE', 'Décès', 10),
    ('VIE', 'Invalidité absolue et définitive', 20),
    ('VIE', 'Terme du contrat', 30),
    ('VIE', 'Rachat', 40)
  ) as t (code, nom, ordre)
  join public.branches b on b.code = t.code
on conflict (branche_id, nom) do nothing;
