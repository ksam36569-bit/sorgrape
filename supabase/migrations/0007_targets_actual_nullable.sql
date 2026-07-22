-- Let a target row exist without an actual.
--
-- actual_value was `not null default 0`, so creating Q1-Q4 up front meant four
-- rows each claiming a reported result of zero. The quarterly achievement trend
-- would then draw a collapse to 0% for quarters that simply have not happened,
-- and measureAchievement would average those zeros into the measure's score.
--
-- Making the column nullable gives "not reported yet" its own representation.
-- Existing rows keep their values -- nothing is set to null here -- so the 24
-- seeded FY25 actuals and every RAG status computed from them are unchanged.

begin;

alter table public.targets alter column actual_value drop not null;
alter table public.targets alter column actual_value drop default;

comment on column public.targets.actual_value is
  'Reported result for the period. NULL means not reported yet, which is not the same as a reported zero -- charts and scores skip NULL rows rather than counting them as a miss.';

commit;
