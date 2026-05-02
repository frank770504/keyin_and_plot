# Technical Specification: CSV to Database Transformation

## 1. Overview
This specification outlines the logic for a one-time or utility script to import rheology measurement data from legacy CSV exports into the `project.db` SQLite database.

## 2. Source Data Details
- **Directory**: `measurement_csv_test/`
- **Filename Pattern**: `${id}_${date} ${name}.csv`
    - `id`: Integer (to be used as `Measurement.id`).
    - `date`: Date string (e.g., `1028`).
    - `name`: Descriptive name.
- **CSV Internal Structure**:
    - **Metadata (Fixed Rows)**:
        - Row 0, Col 1: `Formula ID` $\rightarrow$ `liquid_name`
        - Row 1, Col 1: `Datae` or `Date` $\rightarrow$ `date` (Target format: MM/DD/YYYY)
        - Row 2, Col 1: `Serial ID` $\rightarrow$ `serial_id`
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
    - Parse the filename to extract the `id`.
    - Read rows 0–4 for measurement metadata.
    - Ensure the `date` string is correctly formatted (standardize to MM/DD/YYYY if the CSV value differs).
3.  **Point Extraction**:
    - Skip headers and start at row 10.
    - **Data Cleaning**:
        - Strip whitespace and `%` symbols.
        - Handle empty strings by converting to `None` or skipping rows if mandatory fields (RPM/Viscosity) are missing.
        - Ensure numerical values are cast to `float`.
4.  **Database Integration**:
    - Instantiate a `Measurement` object with the extracted `id`.
    - Create associated `Point` objects.
    - Use `db.session.add()` and `db.session.commit()`.
    - **Safety**: Check for existing records with the same `id` before insertion to prevent `IntegrityError`.

## 4. Execution Plan
1.  **Alignment**: Review this specification.
2.  **Implementation**: Create `import_measurements.py`.
3.  **Verification**:
    - Run the script.
    - Inspect `project.db` using `sqlite3` or the app's UI to confirm data integrity.
