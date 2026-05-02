import os
import csv
import glob
import re
import argparse
from datetime import datetime
from app import create_app
from models import db, Measurement, Point

# Configuration-driven mapping for easy maintenance
# Update this object if the CSV layout or Database field names change.

def parse_date(date_str):
    """Convert date string to a date object."""
    formats = ["%m/%d/%Y", "%d.%m.%Y", "%Y-%m-%d"]
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue
    return None

def safe_float(val):
    """Safely convert string to float, handling commas."""
    if not val or not val.strip():
        return None
    try:
        return float(val.strip().replace(',', ''))
    except ValueError:
        return None

def safe_percent(val):
    """Safely convert percentage string to float."""
    if not val or not val.strip():
        return None
    return safe_float(val.replace('%', ''))

MAPPING_CONFIG = {
    "measurement": {
        "metadata": [
            {"field": "liquid_name", "row": 0, "col": 1, "transform": str.strip},
            {"field": "date", "row": 1, "col": 1, "transform": parse_date},
            {"field": "serial_id", "row": 2, "col": 1, "transform": str.strip},
            {"field": "experiment_note", "row": 0, "col": 3, "transform": str.strip},
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

def import_csv(file_path):
    filename = os.path.basename(file_path)
    if filename.startswith('.~lock'):
        return

    # Extract ID from filename prefix
    match = re.match(r'^(\d+)_', filename)
    if not match:
        return
    meas_id = int(match.group(1))

    with open(file_path, 'r', encoding='utf-8') as f:
        reader = list(csv.reader(f))

        if len(reader) < MAPPING_CONFIG["measurement"]["points_start_row"]:
            return

        # Check for existence using modern Session.get()
        if db.session.get(Measurement, meas_id):
            print(f"Skipping existing measurement {meas_id} ({filename})")
            return

        # Extract Measurement Metadata
        meas_data = {"id": meas_id, "is_draft": False}
        for item in MAPPING_CONFIG["measurement"]["metadata"]:
            try:
                if item["field"] == "experiment_note":
                    raw_val = ""
                    for c in range(0, 3):
                        for r in range(0, 2):
                            raw_val += reader[item["row"] + r][item["col"] + c]
                            raw_val += " "
                else:
                    raw_val = reader[item["row"]][item["col"]]
                meas_data[item["field"]] = item["transform"](raw_val)
            except IndexError:
                meas_data[item["field"]] = None

        measurement = Measurement(**meas_data)
        db.session.add(measurement)

        # Extract Points
        points_added = 0
        start_row = MAPPING_CONFIG["measurement"]["points_start_row"]
        for row_idx in range(start_row, len(reader)):
            row = reader[row_idx]

            # Skip rows that don't have enough columns for our mapping
            max_col = max(item["col"] for item in MAPPING_CONFIG["points"])
            if len(row) <= max_col:
                continue

            # Anchor check: Skip if RPM (N) is empty
            rpm_col = next(item["col"] for item in MAPPING_CONFIG["points"] if item["field"] == "N")
            if not row[rpm_col].strip():
                continue

            point_data = {"measurement": measurement, "is_draft": False}
            try:
                for item in MAPPING_CONFIG["points"]:
                    raw_val = row[item["col"]]
                    point_data[item["field"]] = item["transform"](raw_val)

                # Requirements check: N and eta are usually mandatory for a valid point
                if point_data.get("N") is not None:
                    point = Point(**point_data)
                    db.session.add(point)
                    points_added += 1
            except (ValueError, IndexError):
                continue

        db.session.commit()
        print(f"Imported ID {meas_id} | {meas_data['liquid_name']} | {points_added} points")

def main():
    parser = argparse.ArgumentParser(description="Import Rheology CSV files into project.db")
    parser.add_argument(
        "-i", "--input",
        default="measurement_csv_test",
        help="Directory containing CSV files (default: measurement_csv_test)"
    )
    args = parser.parse_args()

    app = create_app()
    with app.app_context():
        db.create_all()

        input_path = args.input
        if not os.path.exists(input_path):
            print(f"Error: Directory '{input_path}' does not exist.")
            return

        csv_files = glob.glob(os.path.join(input_path, '*.csv'))
        if not csv_files:
            print(f"No CSV files found in '{input_path}'.")
            return

        print(f"Found {len(csv_files)} files in '{input_path}'. Starting import...")
        for f in sorted(csv_files):
            import_csv(f)
        print("Done.")

if __name__ == '__main__':
    main()
