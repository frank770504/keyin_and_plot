Changelog
=========

- **Refactor:** Read endpoints (``get_datasets``, ``get_dataset``) now fetch data directly from the database.
- **Refactor:** Write endpoints (``create_dataset``, ``add_point``, ``delete_dataset``) now write to both the in-memory store and the database to maintain consistency during the transition.

Version 0.2.0 (Unreleased)
--------------------------

- **Feature:** Integrated ``Flask-SQLAlchemy`` to prepare for database integration.
- **Added:** Defined ``Dataset`` and ``Point`` database models in ``app.py``.
- **Added:** The application now creates a ``project.db`` SQLite database on startup.
- **Added:** Initial in-memory data is now automatically loaded into the database on startup for future migration.
- **Added:** ``changelog.rst`` to track changes.
