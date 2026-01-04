from flask import Blueprint, jsonify, request
from models import db, Dataset, Point
import numpy as np
from sklearn.linear_model import LinearRegression

api_bp = Blueprint('api', __name__)

@api_bp.route('/datasets/<string:name>/regression', methods=['GET'])
def get_regression(name):
    """Calculate and return a linear regression for the dataset."""
    dataset = Dataset.query.filter_by(name=name).first()
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    points = dataset.points
    if len(points) < 2:
        return jsonify({"error": "Not enough data points to calculate regression"}), 400

    # Prepare data for scikit-learn
    x_values = np.array([p.x for p in points]).reshape(-1, 1)
    y_values = np.array([p.y for p in points])

    # Perform linear regression
    model = LinearRegression()
    model.fit(x_values, y_values)

    # Calculate R-squared
    r_squared = model.score(x_values, y_values)
    slope = model.coef_[0]
    intercept = model.intercept_

    # Generate points for the regression line
    x_min = np.min(x_values)
    x_max = np.max(x_values)
    x_line = np.linspace(x_min, x_max, 100).reshape(-1, 1)
    y_line = model.predict(x_line)

    regression_points = [{"x": x_line[i][0], "y": y_line[i]} for i in range(len(x_line))]

    return jsonify({
        "regression_points": regression_points,
        "r_squared": r_squared,
        "slope": slope,
        "intercept": intercept
    })

@api_bp.route('/datasets/<string:name>/power-regression', methods=['GET'])
def get_power_regression(name):
    """Calculate and return a power law regression for the dataset."""
    dataset = Dataset.query.filter_by(name=name).first()
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    points = dataset.points
    # Filter for points where x and y are positive for log transformation
    positive_points = [p for p in points if p.x > 0 and p.y > 0]

    if len(positive_points) < 2:
        return jsonify({"error": "Not enough positive data points for power law regression"}), 400

    # Prepare data for log-log linear regression
    log_x_values = np.log(np.array([p.x for p in positive_points])).reshape(-1, 1)
    log_y_values = np.log(np.array([p.y for p in positive_points]))

    model = LinearRegression()
    model.fit(log_x_values, log_y_values)

    r_squared = model.score(log_x_values, log_y_values)
    log_a = model.intercept_
    b = model.coef_[0]
    a = np.exp(log_a)

    # Generate points for the power law curve
    x_min = np.min([p.x for p in positive_points])
    x_max = np.max([p.x for p in positive_points])
    x_line = np.linspace(x_min, x_max, 100)
    y_line = a * (x_line ** b)

    regression_points = [{"x": x_line[i], "y": y_line[i]} for i in range(len(x_line))]

    return jsonify({
        "regression_points": regression_points,
        "r_squared": r_squared,
        "a": a,
        "b": b
    })

@api_bp.route('/datasets', methods=['GET'])
def get_datasets():
    """Return a list of all dataset names."""
    all_datasets = Dataset.query.all()
    dataset_names = [d.name for d in all_datasets]
    return jsonify(dataset_names)

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

    points = [{"id": p.id, "x": p.x, "y": p.y} for p in dataset.points]
    return jsonify(points)

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
    if not data or 'x' not in data or 'y' not in data:
        return jsonify({"error": "Request must include x and y values"}), 400

    try:
        x = float(data['x'])
        y = float(data['y'])
    except (ValueError, TypeError):
        return jsonify({"error": "x and y must be valid numbers"}), 400

    new_point_db = Point(x=x, y=y, dataset=dataset_db)
    db.session.add(new_point_db)
    db.session.commit()

    print(f"Added point ({x}, {y}) to dataset '{name}'")
    return jsonify({"message": "Point added successfully", "id": new_point_db.id}), 201

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

    if 'x' in data:
        try:
            point_to_update.x = float(data['x'])
        except (ValueError, TypeError):
             return jsonify({"error": "x must be a valid number"}), 400

    if 'y' in data:
        try:
            point_to_update.y = float(data['y'])
        except (ValueError, TypeError):
             return jsonify({"error": "y must be a valid number"}), 400

    db.session.commit()

    print(f"Updated point {point_id} in dataset '{name}' to ({point_to_update.x}, {point_to_update.y})")
    return jsonify({"message": "Point updated successfully"}), 200
