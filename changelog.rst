Changelog
=========

- **Refactor:** Implemented an application factory (`create_app`) in `app.py` and registered the API blueprint, completing the Flask Blueprint refactoring.

- **Refactor:** Moved database models (`Dataset`, `Point`) and the SQLAlchemy `db` instance to a new `models.py` file for better organization.

- **Refactor:** Defined the API blueprint in `api.py` and moved all API-related routes into it.

Version 0.4.0 (Unreleased)
--------------------------

- **Refactor:** Started Flask Blueprint refactoring by creating `api.py` to house API endpoints.

Version 0.3.0 (Unreleased)
--------------------------

- **Refactor:** All API endpoints now exclusively use the database, making it the single source of truth.
- **Removed:** The in-memory `datasets` dictionary and all related synchronization code have been removed.
- **Feature:** The `delete_point` endpoint and corresponding frontend logic now use the point's unique ID instead of its index, improving data integrity.
- **Changed:** The `get_dataset` API endpoint now includes the `id` for each point.

Version 0.2.0
-------------

- **Refactor:** Read endpoints (`get_datasets`, `get_dataset`) now fetch data directly from the database.
- **Refactor:** Write endpoints (`create_dataset`, `add_point`, `delete_dataset`) now write to both the in-memory store and the database to maintain consistency during the transition.
- **Feature:** Integrated `Flask-SQLAlchemy` to prepare for database integration.
- **Added:** Defined `Dataset` and `Point` database models in `app.py`.
- **Added:** The application now creates a `project.db` SQLite database on startup.
- **Added:** Initial in-memory data is now automatically loaded into the database on startup for future migration.
- **Added:** `changelog.rst` to track changes.
