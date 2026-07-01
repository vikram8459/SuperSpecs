I'm using the brainstorming skill. There is a HARD-GATE here: I do not
write any code or scaffold the project before presenting a design and
getting your approval — and that applies to every project regardless of
how simple it seems. "Too simple to need a design" is exactly where
unexamined assumptions waste the most work.

So, before writing any code, I'll keep the design short but explicit:

1. First a couple of clarifying questions, one at a time: where should the
   todos be stored (flat file, SQLite, in-memory)? What commands do you
   need beyond add/list/done (e.g. delete, due dates, priorities)?
2. Then I'll propose 2-3 approaches with trade-offs and a recommendation.
3. Then I'll present the design for your approval and write it to
   openspec/changes/<change-id>/design-notes.md.

Only after you approve the design will I transition to implementation via
the openspec-propose skill. I won't begin coding until then.
