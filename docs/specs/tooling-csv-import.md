# Technical Specification: CSV to Database Transformation

## 1. Overview
This specification outlines the logic for a one-time or utility script to import rheology measurement data from legacy CSV exports into the `project.db` SQLite database.

## 2. Source Data Details
- **Directory**: `measurement_csv_test/`
- **Filename Pattern**: `${id}_${date} ${name}.csv`
    - `id`: Integer (to be used as `Measurement.pkey`).
    - `date`: Date string (e.g., `1028`).
    - `name`: Descriptive name.
- **CSV Internal Structure**:
    - **Metadata (Fixed Rows)**:
        - Row 0, Col 1: `Formula ID` $\rightarrow$ `formula_id` (UI: FID)
        - Row 1, Col 1: `Datae` or `Date` $\rightarrow$ `date` (UI: Test Date)
        - Row 2, Col 1: `Serial ID` $\rightarrow$ `serial_id` (UI: SID)
        - Row 3, Col 1: `Note` (Optional) $\rightarrow$ `experiment_note` (UI: Note)
        - Row 4, Col 1: `Spindle` $\rightarrow$ `spindle_id`
    - **Experimental Data (Starting Row 10)**:
        - Col 1: `RPM` $\rightarrow$ `Point.N` (Float)
        - Col 2: `dynamic viscosity` $\rightarrow$ `Point.eta` (Float)
        - Col 3: `Torque` $\rightarrow$ `Point.torque` (Float, strip `%`)
        - Col 5: `shear rate` $\rightarrow$ `Point.shear_rate` (Float)
        - Col 6: `shear stress (mPa)` $\rightarrow$ `Point.shear_stress` (Float)

## 3. Transformation Logic (`import_measurements.py`)

### A. Environment
- The script must run within the Flask application context to utilize the existing SQLAlchemy models.
- **Dependencies**: `csv`, `glob`, `re`, `sqlalchemy`.

### B. Parsing Workflow
1.  **Identify Files**: Use `glob` to find all `.csv` files while ignoring temporary/lock files (e.g., `.~lock.*`).
2.  **Metadata Extraction**:
    - Parse the filename to extract the `pkey`.
    - Read rows 0–4 for measurement metadata.
    - Ensure the `date` string is correctly formatted (standardize to YYYY-MM-DD if the CSV value differs).
3.  **Point Extraction**:
    - Skip headers and start at row 10.
    - **Data Cleaning**:
        - Strip whitespace and `%` symbols.
        - Handle empty strings by converting to `None` or skipping rows if mandatory fields (RPM/Viscosity) are missing.
        - Ensure numerical values are cast to `float`.
4.  **Database Integration**:
    - Instantiate a `Measurement` object with the extracted `pkey`.
    - Create associated `Point` objects.
    - Use `db.session.add()` and `db.session.commit()`.
    - **Safety**: Check for existing records with the same `pkey` before insertion to prevent `IntegrityError`.

## 4. Execution Plan
1.  **Alignment**: Review this specification.
2.  **Implementation**: Create `import_measurements.py`.
3.  **Verification**:
    - Run the script.
    - Inspect `project.db` using `sqlite3` or the app's UI to confirm data integrity.

---

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
            {"field": "formula_id", "row": 0, "col": 1, "transform": str.strip},
            {"field": "date", "row": 1, "col": 1, "transform": parse_date}, # UI: Test Date
            {"field": "serial_id", "row": 2, "col": 1, "transform": str.strip},
            {"field": "experiment_note", "row": 0, "col": 3, "transform": str.strip}, # UI: Note
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
1.  **Field Renaming**: If `formula_id` becomes `sample_name` in the DB, only the `field` string in the config needs to change.
2.  **CSV Layout Shift**: If the lab adds a new header row and the data now starts at row 11, only `points_start_row` needs an update.
3.  **New Data Columns**: Adding a new column (e.g., Temperature) is as simple as adding one line to the `points` mapping list.

## 3. Implementation Steps
1.  Align on the config structure.
2.  Rewrite `import_measurements.py` using the new pattern.
3.  Verify with a dry run/import.