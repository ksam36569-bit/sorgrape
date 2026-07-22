-- Vision and mission copy for the Sogrape scorecard.
--
-- 0002 seeded short placeholder strings. This replaces them with the wording the
-- business actually uses, which the Scorecard tab now renders at the top of the
-- page. Scoped to the seeded scorecard row by id so it cannot touch any other
-- project someone creates in the app.

begin;

update public.projects
set
  vision = 'To be the world''s most admired family-owned wine company — carrying Portuguese winemaking heritage to every corner of the globe and setting the industry benchmark for sustainable, innovative premium wine.',
  mission = 'To craft wines of authentic origin and uncompromising quality through a fully integrated vine-to-glass model — from 1,600 hectares of own vineyards across five countries to consumers in 120+ markets — bringing friendship and happiness to everyone we touch, while creating enduring value for our people, partners, communities and future generations of the family.'
where id = 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid;

commit;
