-- Seed: FY26 OKRs and Key Results.
--
-- Run AFTER 0003_okrs.sql. Idempotent -- fixed uuids, does nothing on conflict.
--
-- Baselines are FY24 actuals where the brief supplied one; where it did not the
-- baseline is 0 and the target is the stated uplift, so progress reads as
-- "distance travelled toward the goal". Current values start at the baseline
-- (nothing reported yet) except STEP roadmap completion, which the brief puts in
-- flight. Every field is editable in the app.

begin;

insert into public.okrs (id, project_id, title, description, owner, position) values
  ('77e86921-e560-5ea9-9a09-7e255a883248'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, 'Premiumise the portfolio to drive higher-value growth', '', 'Commercial', 0),
  ('0ffee320-e695-506a-a8db-3868dc6e34b5'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, 'Consolidate Iberian market leadership', '', 'Iberia', 1),
  ('506cd35c-5a5d-52d7-a99c-00299aaf8fc1'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, 'Boost profitable growth in export and international markets', '', 'Export', 2),
  ('c1f30562-579f-5cde-9ee7-8dc0f9f34032'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, 'Accelerate the Transformation Program (STEP)', '', 'Transformation Office', 3)
on conflict (id) do nothing;


insert into public.key_results (id, project_id, okr_id, description, owner, due_date, unit, baseline, current_value, target, position) values
  ('45037f6f-309f-51d8-8a3a-b7e9ef09503b'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, '77e86921-e560-5ea9-9a09-7e255a883248'::uuid, 'Grow Fine Wines / prestige range''s share of total brand revenue', 'Commercial', '2026-12-31', '%', 18, 18, 25, 0),
  ('1df9a865-6439-5468-9ade-a63efebbc6d2'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, '77e86921-e560-5ea9-9a09-7e255a883248'::uuid, 'Increase average selling price across the top-5 brand portfolio vs FY24', 'Commercial', '2026-12-31', '%', 0, 0, 6, 1),
  ('3a0c7688-2167-5987-b1ed-74132329c865'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, '77e86921-e560-5ea9-9a09-7e255a883248'::uuid, 'Launch new premium SKUs / vintages in FY26', 'Winemaking', '2026-12-31', 'count', 60, 60, 75, 2),
  ('80443562-ebc2-581b-8616-6ab09be66c0f'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, '0ffee320-e695-506a-a8db-3868dc6e34b5'::uuid, 'Grow Iberian Peninsula (Portugal + Spain) share of total sales', 'Iberia', '2026-12-31', '%', 59, 59, 63, 0),
  ('929fa5e6-a88a-5e3b-be3e-eaa77053e01e'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, '0ffee320-e695-506a-a8db-3868dc6e34b5'::uuid, 'Deliver first full-year revenue contribution from the Viña Mayor (Ribera del Duero) acquisition vs plan', 'Iberia', '2026-12-31', '%', 0, 0, 100, 1),
  ('d7119f98-3d27-5ca0-aba4-6bb66db67ada'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, '0ffee320-e695-506a-a8db-3868dc6e34b5'::uuid, 'Grow Spanish wines'' share of total sales', 'Iberia', '2026-12-31', '%', 9, 9, 12, 2),
  ('8279cc8a-9322-5490-85a7-672ec1b14e57'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, '506cd35c-5a5d-52d7-a99c-00299aaf8fc1'::uuid, 'Hold Bet Markets (UK, Portugal, USA, Spain) share of total sales while growing value', 'Export', '2026-12-31', '%', 77, 77, 77, 0),
  ('88dd7502-c71a-5215-a1fe-137b71d42c13'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, '506cd35c-5a5d-52d7-a99c-00299aaf8fc1'::uuid, 'Grow High Potential markets (Angola, Romania, Puerto Rico, Switzerland, Benelux, Nordics)', 'Export', '2026-12-31', '%', 0, 0, 30, 1),
  ('f30555da-7018-5dfd-b622-d47197db95b4'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, '506cd35c-5a5d-52d7-a99c-00299aaf8fc1'::uuid, 'Stabilise or reverse the negative sales trend in underperforming markets (Canada)', 'Export', '2026-12-31', '%', -8, -8, 0, 2),
  ('710c2f42-c914-5674-b86f-970247ddc387'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, 'c1f30562-579f-5cde-9ee7-8dc0f9f34032'::uuid, 'Complete a defined share of the transformational initiatives on the STEP roadmap', 'Transformation Office', '2026-12-31', '%', 0, 25, 60, 0),
  ('71242a8a-4dce-5982-8e2c-ecb75612a867'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, 'c1f30562-579f-5cde-9ee7-8dc0f9f34032'::uuid, 'Scale digital / e-commerce and Wine Tourism revenue, the two named growth axes', 'Digital', '2026-12-31', '%', 0, 0, 20, 1),
  ('dcf010bd-2838-507b-af51-6d658e6fdb03'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, 'c1f30562-579f-5cde-9ee7-8dc0f9f34032'::uuid, 'Deploy additional Sogrape Ventures investments', 'Sogrape Ventures', '2026-12-31', 'count', 1, 1, 3, 2)
on conflict (id) do nothing;


commit;
