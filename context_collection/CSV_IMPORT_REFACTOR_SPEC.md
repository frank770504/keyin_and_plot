# Technical Specification: Refactoring for Maintainability (CSV Import)

## 1. Goal
Refactor `import_measurements.py` to decouple the CSV parsing logic from the `models.py` schema. The script should be "configuration-driven," allowing for easy adjustments when the database structure or CSV layout changes.

## 2. Refactoring Strategy

### A. Centralized Mapping Configuration
Introduce a `MAPPING_CONFIG` object that defines exactly where data resides in the CSV and which model fields it maps to.

```python
MAPPING_CONFIG = {
    "measurement": {
        "metadata": [
            {"field": "liquid_name", "row": 0, "col": 1, "transform": str.strip},
            {"field": "date", "row": 1, "col": 1, "transform": parse_date}, # returns datetime.date
            {"field": "serial_id", "row": 2, "col": 1, "transform": str.strip},
            {"field": "experiment_note", "row": 3, "col": 1, "transform": str.strip},
            {"field": "spindle_id", "row": 4, "col": 1, "transform": str.strip},
        ],
        "points_start_row": 10
    },
    "points": [
        {"field": "N", "col": 1, "transform": safe_float},
        {"field": "eta", "col": 2, "transform": safe_float},
        {"field": "torque", "col": 3, "transform": safe_percent},
        {"field": "shear_rate", "col": 5, "transform": safe_float},
        {"field": "shear_stress", "col": 6, "transform": safe_float},
    ]
}
```

### B. Functional Extraction Logic
- Create a `get_value(row, config)` helper that applies transformations and handles errors gracefully.
- The core loop will iterate through `MAPPING_CONFIG["points"]` and dynamically build a dictionary for the `Point` model.

### C. Benefits
1.  **Field Renaming**: If `liquid_name` becomes `sample_name` in the DB, only the `field` string in the config needs to change.
2.  **CSV Layout Shift**: If the lab adds a new header row and the data now starts at row 11, only `points_start_row` needs an update.
3.  **New Data Columns**: Adding a new column (e.g., Temperature) is as simple as adding one line to the `points` mapping list.

## 3. Implementation Steps
1.  Align on the config structure.
2.  Rewrite `import_measurements.py` using the new pattern.
3.  Verify with a dry run/import.
