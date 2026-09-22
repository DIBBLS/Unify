-- Fresh seed for testing (LASU + MEE 352 Week 1 stub). Run after schema.sql.

insert into universities (name, short_name)
values ('Lagos State University', 'LASU')
on conflict (name) do nothing;

insert into courses (code, title)
values ('MEE 352', 'Unify Learn')
on conflict (code) do nothing;

insert into weeks (course, week, title, subtitle, note_json)
values (
  'MEE 352', 1, 'Week 1', 'Getting started',
  '{"course":"MEE 352","week":1,"title":"Week 1","subtitle":"Getting started","learningOutcome":"","metaChips":[],"tags":[],"topics":[],"eoq":{"questions":[]}}'::jsonb
)
on conflict (course, week) do nothing;
