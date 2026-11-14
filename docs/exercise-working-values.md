# Exercise working values

Personal assigned workout cards now expose working weight (kg) and rest (seconds)
to both the trainee and staff. These optional values are separate from historical
prescriptions (`weight`, `restDuration`) and do not change timers, sets or reps.
Existing plans require no migration: the new fields remain empty until entered.

The authenticated `/api/workouts/exercise-values` POST changes only the named
exercise's `workingValues` on an assigned, non-library personal plan. Trainees
can edit only their own accessible plan. Staff can update assigned personal plans.
Concurrent edits use per-exercise optimistic revision and club-state CAS retries.
Generic state saves preserve the latest server values; newly copied plan or
exercise identities do not inherit another trainee's working values. No new table
or incompatible database migration is required. Old application versions ignore
the optional fields.

Acceptance: open a personal plan as trainee; fields start blank on legacy cards;
save decimal kg and integer rest, refresh, verify staff sees them; edit as staff
then refresh trainee. Clear either field and save. A stale simultaneous save must
show a conflict rather than overwrite. Other trainees/family payers cannot edit
the plan. Existing timed training continues with its original settings.
