"""
APIs
"""

from flask import Blueprint, jsonify, request
import numpy as np
from sklearn.linear_model import LinearRegression

from models import db, Dataset, Point

api_bp = Blueprint('api', __name__)

SPINDLE_ID2FACTOR = {
    "SC4-18": 1.32,
    "SC4-31": 0.34,
    "SC4-34": 0.28
}

@api_bp.route('/datasets/<string:name>/regression', methods=['GET'])
def get_regression(name):
    """Calculate and return a linear regression for the dataset (Shear Stress vs Shear Rate)."""
    dataset = Dataset.query.filter_by(name=name).first()
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    points = dataset.points
    # Filter points where shear_rate and shear_stress are available
    valid_points = [p for p in points if p.shear_rate is not None and p.shear_stress is not None]

    if len(valid_points) < 2:
        return jsonify({"error": "Not enough data points with shear rate/stress to calculate regression"}), 400

    # Prepare data for scikit-learn
    X_values = np.array([p.shear_rate for p in valid_points]).reshape(-1, 1)
    Y_values = np.array([p.shear_stress for p in valid_points])

    # Perform linear regression
    model = LinearRegression()
    model.fit(X_values, Y_values)

    # Calculate R-squared
    r_squared = model.score(X_values, Y_values)
    slope = model.coef_[0]
    intercept = model.intercept_

    # Generate points for the regression line
    X_min = np.min(X_values)
    X_max = np.max(X_values)
    X_line = np.linspace(X_min, X_max, 100).reshape(-1, 1)
    Y_line = model.predict(X_line)

    regression_points = [{"shear_rate": X_line[i][0], "shear_stress": Y_line[i]} for i in range(len(X_line))]

    return jsonify({
        "regression_points": regression_points,
        "r_squared": r_squared,
        "slope": slope,
        "intercept": intercept
    })


@api_bp.route('/datasets/<string:name>/power-regression', methods=['GET'])
def get_power_regression(name):
    """Calculate and return a power law regression for the dataset (Shear Stress vs Shear Rate)."""
    dataset = Dataset.query.filter_by(name=name).first()
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    points = dataset.points
    # Filter for points where shear_rate and shear_stress are positive for log transformation
    positive_points = [p for p in points if p.shear_rate is not None and p.shear_stress is not None and p.shear_rate > 0 and p.shear_stress > 0]

    if len(positive_points) < 2:
        return jsonify({"error": "Not enough positive data points for power law regression"}), 400

    # Prepare data for log-log linear regression
    log_X_values = np.log(np.array([p.shear_rate for p in positive_points])).reshape(-1, 1)
    log_Y_values = np.log(np.array([p.shear_stress for p in positive_points]))

    model = LinearRegression()
    model.fit(log_X_values, log_Y_values)

    r_squared = model.score(log_X_values, log_Y_values)
    log_a = model.intercept_
    b = model.coef_[0]
    a = np.exp(log_a)

    # Generate points for the power law curve
    X_min = np.min([p.shear_rate for p in positive_points])
    X_max = np.max([p.shear_rate for p in positive_points])
    X_line = np.linspace(X_min, X_max, 100)
    Y_line = a * (X_line ** b)

    regression_points = [{"shear_rate": X_line[i], "shear_stress": Y_line[i]} for i in range(len(X_line))]

    return jsonify({
        "regression_points": regression_points,
        "r_squared": r_squared,
        "a": a,
        "b": b
    })


@api_bp.route('/datasets', methods=['GET'])
def get_datasets():
    """Return a list of all datasets with metadata."""
    all_datasets = Dataset.query.all()
    datasets_data = [{
        "name": d.name,
        "date": d.date,
        "serial_id": d.serial_id,
        "spindle_id": d.spindle_id
    } for d in all_datasets]
    return jsonify(datasets_data)


@api_bp.route('/datasets', methods=['POST'])
def create_dataset():
    """Create a new, empty dataset."""
    data = request.get_json()
    if not data or 'name' not in data or not data['name'].strip():
        return jsonify({"error": "Dataset name must be a non-empty string"}), 400

    dataset_name = data['name'].strip()
    if Dataset.query.filter_by(name=dataset_name).first():
        return jsonify({"error": "Dataset with this name already exists"}), 409

    new_dataset_db = Dataset(name=dataset_name)
    db.session.add(new_dataset_db)
    db.session.commit()

    print(f"Created new dataset: '{dataset_name}'")
    return jsonify({"message": f"Dataset '{dataset_name}' created successfully"}), 201


@api_bp.route('/datasets/<string:name>', methods=['GET'])
def get_dataset(name):
    """Return the points for a specific dataset."""
    dataset = Dataset.query.filter_by(name=name).first()
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    points = [{
        "id": p.id, 
        "N": p.N, 
        "eta": p.eta, 
        "torque": p.torque,
        "shear_rate": p.shear_rate,
        "shear_stress": p.shear_stress
    } for p in dataset.points]
    return jsonify({
        "points": points,
        "date": dataset.date,
        "serial_id": dataset.serial_id,
        "spindle_id": dataset.spindle_id
    })


@api_bp.route('/datasets/<string:name>', methods=['PUT'])
def update_dataset(name):
    """Update dataset metadata (like date, serial_id, name)."""
    dataset = Dataset.query.filter_by(name=name).first()
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    data = request.get_json()
    if 'date' in data:
        dataset.date = data['date']
    if 'serial_id' in data:
        dataset.serial_id = data['serial_id']
    if 'spindle_id' in data:
        dataset.spindle_id = data['spindle_id']
        # Recalculate shear properties for all points
        if dataset.spindle_id and dataset.spindle_id in SPINDLE_ID2FACTOR:
            factor = SPINDLE_ID2FACTOR[dataset.spindle_id]
            for point in dataset.points:
                point.shear_rate = factor * point.N
                point.shear_stress = point.eta * point.shear_rate * 0.001
        else:
            for point in dataset.points:
                point.shear_rate = None
                point.shear_stress = None

    if 'name' in data:
        new_name = data['name'].strip()
        if not new_name:
            return jsonify({"error": "New name cannot be empty"}), 400

        # Check if new name already exists and is not the current dataset
        if new_name != name and Dataset.query.filter_by(name=new_name).first():
            return jsonify({"error": "Dataset with this name already exists"}), 409
        dataset.name = new_name

    db.session.commit()
    return jsonify({"message": "Dataset updated successfully"}), 200


@api_bp.route('/datasets/<string:name>', methods=['DELETE'])
def delete_dataset(name):
    """Delete a dataset."""
    dataset_to_delete = Dataset.query.filter_by(name=name).first()
    if not dataset_to_delete:
        return jsonify({"error": "Dataset not found"}), 404

    db.session.delete(dataset_to_delete)
    db.session.commit()

    print(f"Deleted dataset: '{name}'")
    return jsonify({"message": f"Dataset '{name}' deleted"}), 200


@api_bp.route('/datasets/<string:name>/points', methods=['POST'])
def add_point(name):
    """Add a new point to a dataset."""
    dataset_db = Dataset.query.filter_by(name=name).first()
    if not dataset_db:
        return jsonify({"error": "Dataset not found"}), 404

    data = request.get_json()
    if not data or 'N' not in data or 'eta' not in data:
        return jsonify({"error": "Request must include N and eta values"}), 400

    try:
        N = float(data['N'])
        eta = float(data['eta'])
        torque = float(data['torque']) if 'torque' in data and data['torque'] != '' else None
    except (ValueError, TypeError):
        return jsonify({"error": "N, eta and torque must be valid numbers"}), 400

    shear_rate = None
    shear_stress = None
    if dataset_db.spindle_id and dataset_db.spindle_id in SPINDLE_ID2FACTOR:
        factor = SPINDLE_ID2FACTOR[dataset_db.spindle_id]
        shear_rate = factor * N
        shear_stress = eta * shear_rate * 0.001

    new_point_db = Point(
        N=N,
        eta=eta,
        torque=torque,
        shear_rate=shear_rate,
        shear_stress=shear_stress,
        dataset=dataset_db
    )
    db.session.add(new_point_db)
    db.session.commit()

    print(f"Added point ({N}, {eta}) to dataset '{name}'")
    return jsonify({
        "message": "Point added successfully", 
        "id": new_point_db.id,
        "shear_rate": shear_rate,
        "shear_stress": shear_stress
    }), 201


@api_bp.route('/datasets/<string:name>/points/<int:point_id>', methods=['DELETE'])
def delete_point(name, point_id):
    """Delete a point from a dataset by its unique ID."""
    dataset = Dataset.query.filter_by(name=name).first()
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    point_to_delete = Point.query.get(point_id)
    if not point_to_delete or point_to_delete.dataset_id != dataset.id:
        return jsonify({"error": "Point not found in this dataset"}), 404

    db.session.delete(point_to_delete)
    db.session.commit()

    print(f"Deleted point {point_to_delete} from dataset '{name}'")
    return jsonify({"message": "Point deleted"}), 200


@api_bp.route('/datasets/<string:name>/points/<int:point_id>', methods=['PUT'])
def update_point(name, point_id):
    """Update a point in a dataset."""
    dataset = Dataset.query.filter_by(name=name).first()
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    point_to_update = Point.query.get(point_id)
    if not point_to_update or point_to_update.dataset_id != dataset.id:
        return jsonify({"error": "Point not found in this dataset"}), 404

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    if 'N' in data:
        try:
            point_to_update.N = float(data['N'])
        except (ValueError, TypeError):
            return jsonify({"error": "N must be a valid number"}), 400

    if 'eta' in data:
        try:
            point_to_update.eta = float(data['eta'])
        except (ValueError, TypeError):
            return jsonify({"error": "eta must be a valid number"}), 400

    if 'torque' in data:
        try:
            point_to_update.torque = float(data['torque']) if data['torque'] else None
        except (ValueError, TypeError):
            return jsonify({"error": "torque must be a valid number"}), 400

    # Recalculate shear properties based on new or existing values
    if dataset.spindle_id and dataset.spindle_id in SPINDLE_ID2FACTOR:
        factor = SPINDLE_ID2FACTOR[dataset.spindle_id]
        point_to_update.shear_rate = factor * point_to_update.N
        point_to_update.shear_stress = point_to_update.eta * point_to_update.shear_rate * 0.001

    else:
        point_to_update.shear_rate = None
        point_to_update.shear_stress = None

    db.session.commit()

    print(f"Updated point {point_id} in dataset '{name}' to ({point_to_update.N}, {point_to_update.eta})")
    return jsonify({
        "message": "Point updated successfully",
        "shear_rate": point_to_update.shear_rate,
        "shear_stress": point_to_update.shear_stress
    }), 200
