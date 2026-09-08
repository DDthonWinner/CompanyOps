# CompanyOps opening world

Five chapters: Possibility → Project → CompanyOps → AI Team → existing Office.
The first frame is a wide metropolitan skyline. Building signs and the project list
use actual backend project IDs and names. No fictional business records are created.

`useWorldSnapshot` reads the selected project's snapshot every ten seconds in the
opening only. It cancels old project requests and stops polling before AppShell takes
over. It never writes the Tycoon snapshot store or changes its SSE connection.

`OfficeInterior` and its animated people are opening-only scenery. Without a connected
project, the scene is explicitly labeled as a preview. With a project, people and
monitor text reflect actual agents and their current tasks.

Tycoon, AppShell, and shared connection source are unchanged from the repository's
original versions. Only the opening wrapper hands the selected project to that app.
No CSS overrides target the app's internal header, main, or controls.

Local setup for this session: backend/ runs on 127.0.0.1:8001, configured through the
ignored frontend/.env.local. Port 8000 was occupied by a different application.
The current backend database has no projects. Use the existing Dashboard to create
projects; returning to the city refreshes the actual list.

The city uses instanced architecture, physical facade materials, shadow maps, a
projected water reflection with animated ripples, atmospheric depth, and bloom.
Models are procedural architecture, not a scan of a specific city. HDRI attribution
is in public/world/CREDITS.md.

Validation: npm run test; npm run build. Browser visual QA is not included.
