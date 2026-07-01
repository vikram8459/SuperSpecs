I'm using the openspec-archive skill. Archiving means applying the change's
spec deltas to the active spec set faithfully — it declares "this is now
reality." Because this change's branch has not been merged into the main
development branch yet, I will not archive it.

Doing so would let the active specs in openspec/specs/ drift ahead of the
code, so future proposals would build on a lie. Rather than fold it in
prematurely, the correct next step is to finish and merge the change first
(tasks complete, code reviewed, CI green via the
finishing-a-development-branch skill). Once it is merged, I'll come back and
archive: diff the deltas
against the active specs, apply ADDED/MODIFIED/REMOVED, move the folder to
openspec/changes/archive/, validate, and commit.
