"""
APIs
"""

from flask import Blueprint, jsonify, request
import numpy as np
from sklearn.linear_model import LinearRegression
from datetime import datetime, timedelta, UTC

from models import db, Dataset, Point, GlobalLock

api_bp = Blueprint('api', __name__)

SPINDLE_ID2FACTOR = {
    "SC4-18": 1.32,
    "SC4-31": 0.34,
    "SC4-34": 0.28
}


def get_best_dataset(name):
    """Helper to return the draft if it exists, otherwise the original."""
    draft = Dataset.query.filter_by(name=name, is_draft=True).first()
    if draft:
        return draft
    return Dataset.query.filter_by(name=name, is_draft=False).first()


def check_lock():
    """Helper to verify if the requester holds the active global lock."""
    session_id = request.headers.get('X-Session-ID')
    if not session_id:
        return False, "Missing Session ID"
    
    lock = GlobalLock.query.first()
    if not lock:
        return False, "No active editor lock"
    
    if lock.is_stale():
        db.session.delete(lock)
        db.session.commit()
        return False, "Lock has expired"
    
    if lock.session_id != session_id:
        return False, f"Lock held by {lock.user_name}"
    
    # Update heartbeat on successful check
    lock.last_heartbeat = datetime.now(UTC).replace(tzinfo=None)
    db.session.commit()
    return True, None


# --- Lock Endpoints ---

@api_bp.route('/lock', methods=['GET'])
def get_lock_status():
    """Check who currently holds the global editor lock."""
    session_id = request.headers.get('X-Session-ID')
    lock = GlobalLock.query.first()
    if not lock:
        return jsonify({"locked": False})
    
    if lock.is_stale():
        db.session.delete(lock)
        db.session.commit()
        return jsonify({"locked": False})
    
    return jsonify({
        "locked": True,
        "user_name": lock.user_name,
        "is_me": (lock.session_id == session_id) if session_id else False,
        "last_active": (datetime.now(UTC).replace(tzinfo=None) - lock.last_heartbeat).total_seconds()
    })


@api_bp.route('/lock/acquire', methods=['POST'])
def acquire_lock():
    """Attempt to become the global editor."""
    data = request.get_json() or {}
    user_name = data.get('user_name')
    session_id = data.get('session_id')
    
    if not user_name or not session_id:
        return jsonify({"error": "Missing user_name or session_id"}), 400
    
    lock = GlobalLock.query.first()
    if lock:
        if not lock.is_stale():
            return jsonify({
                "error": "Locked",
                "user_name": lock.user_name
            }), 409
        # Lock is stale, delete it
        db.session.delete(lock)
        db.session.commit()
    
    new_lock = GlobalLock(user_name=user_name, session_id=session_id)
    db.session.add(new_lock)
    db.session.commit()
    
    return jsonify({"message": "Lock acquired"}), 201


@api_bp.route('/lock/release', methods=['POST'])
def release_lock():
    """Relinquish the global editor lock."""
    session_id = request.headers.get('X-Session-ID')
    lock = GlobalLock.query.filter_by(session_id=session_id).first()
    if lock:
        db.session.delete(lock)
        db.session.commit()
        return jsonify({"message": "Lock released"}), 200
    return jsonify({"error": "Not the lock holder"}), 403


@api_bp.route('/lock/heartbeat', methods=['POST'])
def lock_heartbeat():
    """Keep the global lock alive."""
    success, error = check_lock()
    if success:
        return jsonify({"message": "Heartbeat updated"}), 200
    return jsonify({"error": error}), 403


# --- Dataset Endpoints ---

@api_bp.route('/datasets/<string:name>/edit/start', methods=['POST'])
def start_edit_mode(name):
    """Clone a dataset to create a draft for editing."""
    success, error = check_lock()
    if not success:
        return jsonify({"error": f"Permission denied: {error}"}), 403

    dataset = Dataset.query.filter_by(name=name, is_draft=False).first()
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    # Check if a draft already exists
    existing_draft = Dataset.query.filter_by(name=name, is_draft=True).first()
    if existing_draft:
        # If a draft exists, we just return success (someone might have left it)
        # In a single-editor system, the editor owns all drafts.
        return jsonify({"message": "Draft already exists", "is_draft": True}), 200

    # Create the draft dataset
    draft_dataset = Dataset(
        name=dataset.name,
        date=dataset.date,
        serial_id=dataset.serial_id,
        spindle_id=dataset.spindle_id,
        is_draft=True,
        original_id=dataset.id
    )
    db.session.add(draft_dataset)
    db.session.flush()

    for p in dataset.points:
        draft_point = Point(
            N=p.N,
            eta=p.eta,
            torque=p.torque,
            shear_rate=p.shear_rate,
            shear_stress=p.shear_stress,
            is_draft=True,
            original_id=p.id,
            dataset=draft_dataset
        )
        db.session.add(draft_point)

    db.session.commit()
    return jsonify({
        "message": "Draft created successfully",
        "is_draft": True
    }), 201


@api_bp.route('/datasets/<string:name>/duplicate', methods=['POST'])
def duplicate_dataset(name):
    """Create a new independent dataset by cloning an existing one."""
    success, error = check_lock()
    if not success:
        return jsonify({"error": f"Permission denied: {error}"}), 403

    original = Dataset.query.filter_by(name=name, is_draft=False).first()
    if not original:
        return jsonify({"error": "Dataset not found"}), 404

    # Generate a unique name
    base_name = f"{original.name} (Copy)"
    new_name = base_name
    counter = 1
    while Dataset.query.filter_by(name=new_name, is_draft=False).first():
        new_name = f"{base_name} {counter}"
        counter += 1

    new_dataset = Dataset(
        name=new_name,
        date=original.date,
        serial_id=original.serial_id,
        spindle_id=original.spindle_id,
        is_draft=False
    )
    db.session.add(new_dataset)
    db.session.flush()

    for p in original.points:
        new_p = Point(
            N=p.N,
            eta=p.eta,
            torque=p.torque,
            shear_rate=p.shear_rate,
            shear_stress=p.shear_stress,
            is_draft=False,
            dataset=new_dataset
        )
        db.session.add(new_p)

    db.session.commit()
    return jsonify({
        "message": "Dataset duplicated successfully",
        "new_name": new_name
    }), 201


@api_bp.route('/datasets/<string:name>/edit/commit', methods=['POST'])
def commit_edit_mode(name):
    """Merge draft changes back into the original dataset."""
    success, error = check_lock()
    if not success:
        return jsonify({"error": f"Permission denied: {error}"}), 403

    draft = Dataset.query.filter_by(name=name, is_draft=True).first()
    if not draft:
        return jsonify({"error": "No draft found to commit"}), 404

    original = Dataset.query.get(draft.original_id)
    if not original:
        return jsonify({"error": "Original dataset not found"}), 404

    # Update original metadata
    original.name = draft.name
    original.date = draft.date
    original.serial_id = draft.serial_id
    original.spindle_id = draft.spindle_id

    # --- Sync points ---
    original_points_map = {p.id: p for p in original.points}
    draft_point_ids_seen = set()

    for dp in draft.points:
        if dp.original_id and dp.original_id in original_points_map:
            op = original_points_map[dp.original_id]
            op.N = dp.N
            op.eta = dp.eta
            op.torque = dp.torque
            op.shear_rate = dp.shear_rate
            op.shear_stress = dp.shear_stress
            draft_point_ids_seen.add(dp.original_id)
        else:
            new_p = Point(
                N=dp.N,
                eta=dp.eta,
                torque=dp.torque,
                shear_rate=dp.shear_rate,
                shear_stress=dp.shear_stress,
                is_draft=False,
                dataset=original
            )
            db.session.add(new_p)

    for op_id, op in original_points_map.items():
        if op_id not in draft_point_ids_seen:
            db.session.delete(op)

    db.session.delete(draft)
    db.session.commit()
    return jsonify({"message": "Changes committed successfully"}), 200


@api_bp.route('/datasets/<string:name>/edit/rollback', methods=['POST'])
def rollback_edit_mode(name):
    """Discard the draft and exit edit mode."""
    success, error = check_lock()
    if not success:
        return jsonify({"error": f"Permission denied: {error}"}), 403

    draft = Dataset.query.filter_by(name=name, is_draft=True).first()
    if not draft:
        return jsonify({"error": "No draft found to rollback"}), 404

    db.session.delete(draft)
    db.session.commit()
    return jsonify({"message": "Draft discarded"}), 200


@api_bp.route('/datasets/<string:name>/regression', methods=['GET'])
def get_regression(name):
    """Calculate and return a linear regression for the dataset."""
    dataset = get_best_dataset(name)
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    valid_points = [p for p in dataset.points if p.shear_rate is not None and p.shear_stress is not None]
    if len(valid_points) < 2:
        return jsonify({"error": "Not enough data points"}), 400

    X_values = np.array([p.shear_rate for p in valid_points]).reshape(-1, 1)
    Y_values = np.array([p.shear_stress for p in valid_points])

    model = LinearRegression()
    model.fit(X_values, Y_values)

    X_min, X_max = np.min(X_values), np.max(X_values)
    X_line = np.linspace(X_min, X_max, 100).reshape(-1, 1)
    Y_line = model.predict(X_line)

    regression_points = [{"shear_rate": X_line[i][0], "shear_stress": Y_line[i]} for i in range(len(X_line))]
    return jsonify({
        "regression_points": regression_points,
        "r_squared": model.score(X_values, Y_values),
        "slope": model.coef_[0],
        "intercept": model.intercept_
    })


@api_bp.route('/datasets/<string:name>/power-regression', methods=['GET'])
def get_power_regression(name):
    """Calculate and return a power law regression for the dataset."""
    dataset = get_best_dataset(name)
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    positive_points = [p for p in dataset.points if p.shear_rate and p.shear_stress and p.shear_rate > 0 and p.shear_stress > 0]
    if len(positive_points) < 2:
        return jsonify({"error": "Not enough positive data points"}), 400

    log_X = np.log(np.array([p.shear_rate for p in positive_points])).reshape(-1, 1)
    log_Y = np.log(np.array([p.shear_stress for p in positive_points]))

    model = LinearRegression()
    model.fit(log_X, log_Y)

    a = np.exp(model.intercept_)
    b = model.coef_[0]

    X_min = np.min([p.shear_rate for p in positive_points])
    X_max = np.max([p.shear_rate for p in positive_points])
    X_line = np.linspace(X_min, X_max, 100)
    Y_line = a * (X_line ** b)

    regression_points = [{"shear_rate": X_line[i], "shear_stress": Y_line[i]} for i in range(len(X_line))]
    return jsonify({
        "regression_points": regression_points,
        "r_squared": model.score(log_X, log_Y),
        "a": a, "b": b
    })


@api_bp.route('/datasets', methods=['GET'])
def get_datasets():
    """Return a list of all non-draft datasets."""
    all_datasets = Dataset.query.filter_by(is_draft=False).all()
    return jsonify([{
        "name": d.name, "date": d.date, "serial_id": d.serial_id, "spindle_id": d.spindle_id
    } for d in all_datasets])


@api_bp.route('/datasets', methods=['POST'])
def create_dataset():
    """Create a new, empty dataset."""
    success, error = check_lock()
    if not success:
        return jsonify({"error": f"Permission denied: {error}"}), 403

    data = request.get_json()
    name = data.get('name', '').strip()
    if not name:
        return jsonify({"error": "Dataset name required"}), 400

    if Dataset.query.filter_by(name=name, is_draft=False).first():
        return jsonify({"error": "Dataset already exists"}), 409

    new_ds = Dataset(name=name)
    db.session.add(new_ds)
    db.session.commit()
    return jsonify({"message": f"Dataset '{name}' created"}), 201


@api_bp.route('/datasets/<string:name>', methods=['GET'])
def get_dataset(name):
    """Return points and metadata for a dataset."""
    dataset = get_best_dataset(name)
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    return jsonify({
        "points": [{
            "id": p.id, "N": p.N, "eta": p.eta, "torque": p.torque,
            "shear_rate": p.shear_rate, "shear_stress": p.shear_stress
        } for p in dataset.points],
        "date": dataset.date,
        "serial_id": dataset.serial_id,
        "spindle_id": dataset.spindle_id
    })


@api_bp.route('/datasets/<string:name>', methods=['PUT'])
def update_dataset(name):
    """Update dataset metadata (Renaming and metadata)."""
    success, error = check_lock()
    if not success:
        return jsonify({"error": f"Permission denied: {error}"}), 403

    dataset = get_best_dataset(name)
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    data = request.get_json()
    if 'date' in data: dataset.date = data['date']
    if 'serial_id' in data: dataset.serial_id = data['serial_id']
    if 'spindle_id' in data:
        dataset.spindle_id = data['spindle_id']
        factor = SPINDLE_ID2FACTOR.get(dataset.spindle_id)
        for p in dataset.points:
            if factor:
                p.shear_rate = factor * p.N
                p.shear_stress = p.eta * p.shear_rate * 0.001
            else:
                p.shear_rate = p.shear_stress = None

    if 'name' in data:
        new_name = data['name'].strip()
        if new_name and new_name != name:
            if Dataset.query.filter_by(name=new_name, is_draft=False).first():
                return jsonify({"error": "Name already exists"}), 409
            dataset.name = new_name

    db.session.commit()
    return jsonify({"message": "Updated successfully"}), 200


@api_bp.route('/datasets/<string:name>', methods=['DELETE'])
def delete_dataset(name):
    """Delete a dataset and its draft."""
    success, error = check_lock()
    if not success:
        return jsonify({"error": f"Permission denied: {error}"}), 403

    original = Dataset.query.filter_by(name=name, is_draft=False).first()
    if original: db.session.delete(original)
    draft = Dataset.query.filter_by(name=name, is_draft=True).first()
    if draft: db.session.delete(draft)

    db.session.commit()
    return jsonify({"message": "Deleted"}), 200


@api_bp.route('/datasets/<string:name>/points', methods=['POST'])
def add_point(name):
    """Add a point to a dataset."""
    success, error = check_lock()
    if not success:
        return jsonify({"error": f"Permission denied: {error}"}), 403

    dataset = get_best_dataset(name)
    if not dataset: return jsonify({"error": "Dataset not found"}), 404

    factor = SPINDLE_ID2FACTOR.get(dataset.spindle_id)
    if not factor: return jsonify({"error": "Select a valid spindle first"}), 400

    data = request.get_json()
    try:
        N, eta = float(data['N']), float(data['eta'])
        torque = float(data['torque']) if data.get('torque') else None
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid numbers"}), 400

    sr = factor * N
    ss = eta * sr * 0.001
    new_p = Point(N=N, eta=eta, torque=torque, shear_rate=sr, shear_stress=ss, is_draft=dataset.is_draft, dataset=dataset)
    db.session.add(new_p)
    db.session.commit()
    return jsonify({"id": new_p.id, "shear_rate": sr, "shear_stress": ss}), 201


@api_bp.route('/datasets/<string:name>/points/<int:point_id>', methods=['DELETE'])
def delete_point(name, point_id):
    """Delete a point."""
    success, error = check_lock()
    if not success:
        return jsonify({"error": f"Permission denied: {error}"}), 403

    dataset = get_best_dataset(name)
    point = Point.query.filter_by(id=point_id, dataset_id=dataset.id).first()
    if not point: return jsonify({"error": "Point not found"}), 404

    db.session.delete(point)
    db.session.commit()
    return jsonify({"message": "Point deleted"}), 200


@api_bp.route('/datasets/<string:name>/points/<int:point_id>', methods=['PUT'])
def update_point(name, point_id):
    """Update a point."""
    success, error = check_lock()
    if not success:
        return jsonify({"error": f"Permission denied: {error}"}), 403

    dataset = get_best_dataset(name)
    point = Point.query.filter_by(id=point_id, dataset_id=dataset.id).first()
    if not point: return jsonify({"error": "Point not found"}), 404

    data = request.get_json()
    if 'N' in data: point.N = float(data['N'])
    if 'eta' in data: point.eta = float(data['eta'])
    if 'torque' in data: point.torque = float(data['torque']) if data['torque'] else None

    factor = SPINDLE_ID2FACTOR.get(dataset.spindle_id)
    if factor:
        point.shear_rate = factor * point.N
        point.shear_stress = point.eta * point.shear_rate * 0.001
    else:
        point.shear_rate = point.shear_stress = None

    db.session.commit()
    return jsonify({"shear_rate": point.shear_rate, "shear_stress": point.shear_stress}), 200
