-- Departments and a connected strategy map.
--
-- Run AFTER 0002_seed_fy25.sql. Idempotent -- fixed uuids, does nothing on conflict.
--
-- Departments: the workbook has no department column, so these are the standard
-- Sogrape functions. Objectives are not assigned to them yet; do that in the app
-- and the Department view and its dashboard chart start working.
--
-- Strategy edges: a Kaplan-Norton chain reading bottom-up, Learning & Growth ->
-- Internal Process -> Customer -> Financial. Adjacent perspectives only, with one
-- deliberate exception: supply chain feeds capital efficiency directly, because
-- nothing in Customer plausibly drives it and inventing a link would make a
-- tidier map that tells a wrong story.

begin;

insert into public.departments (id, project_id, name) values
  ('a75cd1a0-2f8c-504e-ba5c-9d52a11eb0c4'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, 'Sales & Distribution'),
  ('c5327761-2f4d-5a6b-8927-9e09ad7360b6'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, 'Marketing'),
  ('07cc9a4b-10bf-5274-83d9-ea8750752b53'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, 'Winemaking'),
  ('7a16854f-b374-57c8-99bb-15a5b8ee1fe9'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, 'Operations'),
  ('2c217adf-575c-5b8a-b76c-833eb619cb18'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, 'Finance'),
  ('8028d502-85d9-5db4-a7a2-79fc73c624cd'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, 'HR & People')
on conflict (id) do nothing;

insert into public.strategy_edges (id, project_id, source, target, label) values
  ('adff1824-a58f-5c5e-805c-3ba3058ed8e3'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, 'd5151598-9da9-4cf1-aac2-2d38db500717'::uuid, '8fac358e-bead-4dbf-8270-6272b0ac799e'::uuid, 'enables'),
  ('9748ca2f-3082-595a-a93f-4f7662cc0c7a'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, 'd5151598-9da9-4cf1-aac2-2d38db500717'::uuid, '4ae0f98f-54e0-48dc-93e6-b8704160200c'::uuid, 'enables'),
  ('cfc55e2e-5f42-57ee-b0ad-2c56414b47ae'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, '16393f86-7623-4da0-8bde-c7ea5d97a232'::uuid, '8fac358e-bead-4dbf-8270-6272b0ac799e'::uuid, 'drives'),
  ('c7a12102-924c-5de5-93d3-c6f9ae125fbe'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, '16393f86-7623-4da0-8bde-c7ea5d97a232'::uuid, 'bb47e036-a52f-471e-b6c1-08bca8a206fb'::uuid, 'drives'),
  ('7030d40c-168a-5440-81ef-bc724991c85e'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, 'fcb23b1c-99a4-4632-8f82-05537f7d5c36'::uuid, 'bb47e036-a52f-471e-b6c1-08bca8a206fb'::uuid, 'staffs'),
  ('f1f19114-dd0c-54a6-9762-fb45bc9c5398'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, '8fac358e-bead-4dbf-8270-6272b0ac799e'::uuid, 'b70c109b-63bc-4549-b1fd-c8d499ce1a98'::uuid, 'reaches'),
  ('bc15b769-e84c-59d7-b2e2-7d42590aebf2'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, '8fac358e-bead-4dbf-8270-6272b0ac799e'::uuid, '09168440-fa62-4bd5-b501-afe8273eb518'::uuid, 'enables'),
  ('3298991d-b0fa-5697-8c78-76a8609d6c13'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, '4ae0f98f-54e0-48dc-93e6-b8704160200c'::uuid, '959f4306-6160-475d-b643-b8c673bed4a0'::uuid, 'improves'),
  ('601c4a09-0a6d-518c-885f-7a0dd777434a'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, 'bb47e036-a52f-471e-b6c1-08bca8a206fb'::uuid, '959f4306-6160-475d-b643-b8c673bed4a0'::uuid, 'supplies'),
  ('137fc03d-07ef-5eab-a410-4bbd381ce1a3'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, 'b70c109b-63bc-4549-b1fd-c8d499ce1a98'::uuid, '204e4a40-989d-4a1f-9af2-6ea79a51a851'::uuid, 'converts to'),
  ('bb5fd2a2-5ced-52bb-9489-70ce5f4cbd2c'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, '959f4306-6160-475d-b643-b8c673bed4a0'::uuid, '204e4a40-989d-4a1f-9af2-6ea79a51a851'::uuid, 'sustains'),
  ('5813aa76-0a2c-59bf-94d2-c806b464755a'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, 'b70c109b-63bc-4549-b1fd-c8d499ce1a98'::uuid, '78ad33d3-c12d-4e41-bfce-34f9b07a1dac'::uuid, 'supports pricing'),
  ('0e2cb5d4-fbce-5be8-a264-d977028e2f78'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, '09168440-fa62-4bd5-b501-afe8273eb518'::uuid, '78ad33d3-c12d-4e41-bfce-34f9b07a1dac'::uuid, 'lifts margin'),
  ('a2957055-0cf2-5de5-8849-f843f8087853'::uuid, 'af56d9a2-6f5b-437c-a003-c25fbff0fc3b'::uuid, '4ae0f98f-54e0-48dc-93e6-b8704160200c'::uuid, '9b3badc4-d4f1-438e-ba01-b7122dfea396'::uuid, 'frees capital')
on conflict (id) do nothing;

commit;
