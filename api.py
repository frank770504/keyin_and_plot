"""
APIs
"""

from datetime import datetime, UTC
from flask import Blueprint, jsonify, request
import numpy as np
from sklearn.linear_model import LinearRegression

from models import db, Measurement, Point, GlobalLock

api_bp = Blueprint('api', __name__)

SPINDLE_ID2FACTOR = {
    "SC4-18": 1.32,
    "SC4-31": 0.34,
    "SC4-34": 0.28
}


def get_best_measurement(measurement_pkey):
    """Helper to return the draft if it exists, otherwise the original."""
    # If we are looking for a specific ID, it might be a draft or a production record.
    # In the single-editor model, there is only one draft.
    # If the requested ID is for an original, we should check if a draft exists for it.

    m = db.session.get(Measurement, measurement_pkey)
    if not m:
        return None

    if not m.is_draft:
        # Check if there is a draft referencing this original
        draft = Measurement.query.filter_by(original_id=m.pkey, is_draft=True).first()
        if draft:
            return draft
    return m


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
        "last_active": (
            (datetime.now(UTC).replace(tzinfo=None) -
                lock.last_heartbeat).total_seconds())
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

    return jsonify({
        "message": "Lock acquired",
        "user_name": user_name,
        "is_me": True
    }), 201


@api_bp.route('/lock/release', methods=['POST'])
def release_lock():
    """Relinquish the global editor lock."""
    session_id = request.headers.get('X-Session-ID')

    # Fallback to JSON body for sendBeacon support
    if not session_id and request.is_json:
        data = request.get_json()
        session_id = data.get('session_id')

    if not session_id:
        return jsonify({"error": "Missing Session ID"}), 400

    lock = GlobalLock.query.filter_by(session_id=session_id).first()

    if lock:
        db.session.delete(lock)
        db.session.commit()
        return jsonify({"message": "Lock released"}), 200
    return jsonify({"error": "Not the lock holder or lock not found"}), 403


@api_bp.route('/lock/heartbeat', methods=['POST'])
def lock_heartbeat():
    """Keep the global lock alive."""
    success, error = check_lock()
    if success:
        return jsonify({"message": "Heartbeat updated"}), 200
    return jsonify({"error": error}), 403


# --- Measurement Endpoints ---

@api_bp.route('/measurements/<int:measurement_id>/edit/start', methods=['POST'])
def start_edit_mode(measurement_id):
    """Clone a measurement to create a draft for editing."""
    success, error = check_lock()
    if not success:
        return jsonify({"error": f"Permission denied: {error}"}), 403

    # Clean up any orphaned drafts for other measurements
    other_drafts = Measurement.query.filter_by(is_draft=True).all()
    for d in other_drafts:
        if d.original_id != measurement_id:
            db.session.delete(d)
    db.session.flush()

    measurement = Measurement.query.filter_by(pkey=measurement_id, is_draft=False).first()
    if not measurement:
        return jsonify({"error": "Measurement not found"}), 404

    # Check if a draft already exists for THIS measurement
    existing_draft = Measurement.query.filter_by(original_id=measurement_id, is_draft=True).first()
    if existing_draft:
        return jsonify({
            "message": "Draft already exists",
            "is_draft": True,
            "pkey": existing_draft.pkey
        }), 200

    # Create the draft measurement
    draft_measurement = Measurement(
        formula_id=measurement.formula_id,
        date=measurement.date,
        serial_id=measurement.serial_id,
        spindle_id=measurement.spindle_id,
        experiment_note=measurement.experiment_note,
        is_draft=True,
        original_id=measurement.pkey,
        edit_ip=request.remote_addr,
        edit_date=datetime.now(UTC).isoformat()
    )
    db.session.add(draft_measurement)
    db.session.flush()

    for p in measurement.points:
        draft_point = Point(
            N=p.N,
            eta=p.eta,
            torque=p.torque,
            shear_rate=p.shear_rate,
            shear_stress=p.shear_stress,
            is_draft=True,
            original_id=p.id,
            measurement=draft_measurement
        )
        db.session.add(draft_point)

    db.session.commit()
    return jsonify({
        "message": "Draft created successfully",
        "is_draft": True,
        "pkey": draft_measurement.pkey
    }), 201


@api_bp.route('/measurements/<int:measurement_id>/duplicate', methods=['POST'])
def duplicate_measurement(measurement_id):
    """Create a new independent measurement by cloning an existing one."""
    success, error = check_lock()
    if not success:
        return jsonify({"error": f"Permission denied: {error}"}), 403

    original = Measurement.query.filter_by(pkey=measurement_id, is_draft=False).first()
    if not original:
        return jsonify({"error": "Measurement not found"}), 404

    new_measurement = Measurement(
        formula_id=f"{original.formula_id} (Copy)",
        date=original.date,
        serial_id=original.serial_id,
        spindle_id=original.spindle_id,
        experiment_note=original.experiment_note,
        is_draft=False,
        edit_ip=request.remote_addr,
        edit_date=datetime.now(UTC).isoformat()
    )
    db.session.add(new_measurement)
    db.session.flush()

    for p in original.points:
        new_p = Point(
            N=p.N,
            eta=p.eta,
            torque=p.torque,
            shear_rate=p.shear_rate,
            shear_stress=p.shear_stress,
            is_draft=False,
            measurement=new_measurement
        )
        db.session.add(new_p)

    db.session.commit()
    return jsonify({
        "message": "Measurement duplicated successfully",
        "new_pkey": new_measurement.pkey
    }), 201


@api_bp.route('/measurements/<int:measurement_id>/edit/commit', methods=['POST'])
def commit_edit_mode(measurement_id):
    """Merge draft changes back into the original measurement or promote a new draft."""
    success, error = check_lock()
    if not success:
        return jsonify({"error": f"Permission denied: {error}"}), 403

    draft = Measurement.query.filter_by(pkey=measurement_id, is_draft=True).first()
    if not draft:
        return jsonify({"error": "No draft found to commit"}), 404

    if draft.original_id is None:
        # Case: New Measurement Creation
        # Promote draft to production
        draft.is_draft = False
        draft.edit_ip = request.remote_addr
        draft.edit_date = datetime.now(UTC).isoformat()
        for p in draft.points:
            p.is_draft = False
        db.session.commit()
        return jsonify({
            "message": "New measurement created successfully",
            "pkey": draft.pkey
        }), 201

    # Case: Editing existing measurement
    original = db.session.get(Measurement, draft.original_id)
    if not original:
        return jsonify({"error": "Original measurement not found"}), 404

    # Update original metadata
    original.formula_id = draft.formula_id
    original.date = draft.date
    original.serial_id = draft.serial_id
    original.spindle_id = draft.spindle_id
    original.experiment_note = draft.experiment_note
    original.edit_ip = request.remote_addr
    original.edit_date = datetime.now(UTC).isoformat()

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
                measurement=original
            )
            db.session.add(new_p)

    for op_id, op in original_points_map.items():
        if op_id not in draft_point_ids_seen:
            db.session.delete(op)

    db.session.delete(draft)
    db.session.commit()
    return jsonify({"message": "Changes committed successfully", "pkey": original.pkey}), 200


@api_bp.route('/measurements/<int:measurement_id>/edit/rollback', methods=['POST'])
def rollback_edit_mode(measurement_id):
    """Discard the draft and exit edit mode."""
    success, error = check_lock()
    if not success:
        return jsonify({"error": f"Permission denied: {error}"}), 403

    draft = Measurement.query.filter_by(pkey=measurement_id, is_draft=True).first()
    if not draft:
        return jsonify({"error": "No draft found to rollback"}), 404

    db.session.delete(draft)
    db.session.commit()
    return jsonify({"message": "Draft discarded"}), 200


@api_bp.route('/measurements/<int:measurement_id>/regression', methods=['GET'])
def get_regression(measurement_id):
    """Calculate and return a linear regression for the measurement."""
    measurement = get_best_measurement(measurement_id)
    if not measurement:
        return jsonify({"error": "Measurement not found"}), 404

    valid_points = [
        p for p in measurement.points
        if p.shear_rate is not None and p.shear_stress is not None
    ]
    if len(valid_points) < 2:
        return jsonify({"error": "Not enough data points"}), 400

    x_values = np.array([p.shear_rate for p in valid_points]).reshape(-1, 1)
    y_values = np.array([p.shear_stress for p in valid_points])

    model = LinearRegression()
    model.fit(x_values, y_values)

    x_min, x_max = np.min(x_values), np.max(x_values)
    x_line = np.linspace(x_min, x_max, 100).reshape(-1, 1)
    y_line = model.predict(x_line)

    regression_points = [{
        "shear_rate": x_line[i][0],
        "shear_stress": y_line[i]} for i in range(len(x_line))]
    return jsonify({
        "regression_points": regression_points,
        "r_squared": model.score(x_values, y_values),
        "slope": model.coef_[0],
        "intercept": model.intercept_
    })


@api_bp.route('/measurements/<int:measurement_id>/power-regression', methods=['GET'])
def get_power_regression(measurement_id):
    """Calculate and return a power law regression for the measurement."""
    measurement = get_best_measurement(measurement_id)
    if not measurement:
        return jsonify({"error": "Measurement not found"}), 404

    positive_points = [
            p for p in measurement.points
            if p.shear_rate and p.shear_stress and p.shear_rate > 0 and p.shear_stress > 0
    ]
    if len(positive_points) < 2:
        return jsonify({"error": "Not enough positive data points"}), 400

    log_X = np.log(np.array([p.shear_rate for p in positive_points])).reshape(-1, 1)
    log_Y = np.log(np.array([p.shear_stress for p in positive_points]))

    model = LinearRegression()
    model.fit(log_X, log_Y)

    a = np.exp(model.intercept_)
    b = model.coef_[0]

    x_min = np.min([p.shear_rate for p in positive_points])
    x_max = np.max([p.shear_rate for p in positive_points])
    x_line = np.linspace(x_min, x_max, 100)
    y_line = a * (x_line ** b)

    regression_points = [{
        "shear_rate": x_line[i],
        "shear_stress": y_line[i]} for i in range(len(x_line))]
    return jsonify({
        "regression_points": regression_points,
        "r_squared": model.score(log_X, log_Y),
        "a": a, "b": b
    })


@api_bp.route('/measurements', methods=['GET'])
def get_measurements():
    """
        Return a list of measurements. If a production measurement has an active draft,
        return only the draft to avoid duplicates in the UI.
    """
    production_measurements = Measurement.query.filter_by(is_draft=False).all()
    
    # Check if there is an active draft for this session
    session_id = request.headers.get('X-Session-ID')
    active_draft = None
    if session_id:
        lock = GlobalLock.query.filter_by(session_id=session_id).first()
        if lock:
            active_draft = Measurement.query.filter_by(is_draft=True).first()

    results = []
    draft_original_id = active_draft.original_id if active_draft else None

    for m in production_measurements:
        if m.pkey == draft_original_id:
            # Skip the original because we will add the draft instead
            continue
        results.append(m)

    if active_draft:
        results.append(active_draft)

    return jsonify([{
        "pkey": d.pkey, "formula_id": d.formula_id,
        "date": d.date.isoformat() if d.date else None,
        "serial_id": d.serial_id, "spindle_id": d.spindle_id,
        "experiment_note": d.experiment_note,
        "is_draft": d.is_draft, "original_id": d.original_id,
        "edit_ip": d.edit_ip, "edit_date": d.edit_date
    } for d in results])


@api_bp.route('/measurements', methods=['POST'])
def add_measurement():
    """Create a new, empty measurement as a draft."""
    success, error = check_lock()
    if not success:
        return jsonify({"error": f"Permission denied: {error}"}), 403

    # Clean up any orphaned drafts to maintain the single-editor model
    orphaned_drafts = Measurement.query.filter_by(is_draft=True).all()
    for d in orphaned_drafts:
        db.session.delete(d)
    db.session.flush()

    data = request.get_json() or {}
    formula_id = data.get('formula_id', '').strip() or "New Measurement"

    new_measurement = Measurement(
        formula_id=formula_id,
        is_draft=True,
        original_id=None,
        edit_ip=request.remote_addr,
        edit_date=datetime.now(UTC).isoformat()
    )
    db.session.add(new_measurement)
    db.session.commit()
    return jsonify({
        "message": f"Measurement '{formula_id}' initialized as draft",
        "pkey": new_measurement.pkey,
        "formula_id": formula_id
    }), 201


@api_bp.route('/measurements/<int:measurement_id>', methods=['GET'])
def get_measurement(measurement_id):
    """Return points and metadata for a measurement."""
    measurement = get_best_measurement(measurement_id)
    if not measurement:
        return jsonify({"error": "Measurement not found"}), 404

    return jsonify({
        "pkey": measurement.pkey,
        "formula_id": measurement.formula_id,
        "points": [{
            "id": p.id, "N": p.N, "eta": p.eta, "torque": p.torque,
            "shear_rate": p.shear_rate, "shear_stress": p.shear_stress
        } for p in measurement.points],
        "date": measurement.date.isoformat() if measurement.date else None,
        "serial_id": measurement.serial_id,
        "spindle_id": measurement.spindle_id,
        "experiment_note": measurement.experiment_note,
        "is_draft": measurement.is_draft,
        "original_id": measurement.original_id,
        "edit_ip": measurement.edit_ip,
        "edit_date": measurement.edit_date
    })


@api_bp.route('/measurements/<int:measurement_id>', methods=['PUT'])
def update_measurement(measurement_id):
    """Update measurement metadata (Renaming and metadata)."""
    success, error = check_lock()
    if not success:
        return jsonify({"error": f"Permission denied: {error}"}), 403

    measurement = get_best_measurement(measurement_id)
    if not measurement:
        return jsonify({"error": "Measurement not found"}), 404

    data = request.get_json()
    if 'date' in data and data['date']:
        try:
            measurement.date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        except (ValueError, TypeError):
            # Fallback or silent ignore if format is wrong, 
            # though frontend should send YYYY-MM-DD
            pass
    elif 'date' in data:
        measurement.date = None
    if 'serial_id' in data:
        measurement.serial_id = data['serial_id']
    if 'experiment_note' in data:
        measurement.experiment_note = data['experiment_note']
    if 'spindle_id' in data:
        measurement.spindle_id = data['spindle_id']
        factor = SPINDLE_ID2FACTOR.get(measurement.spindle_id)
        for p in measurement.points:
            if factor:
                p.shear_rate = factor * p.N
                p.shear_stress = p.eta * p.shear_rate * 0.001
            else:
                p.shear_rate = p.shear_stress = None

    if 'formula_id' in data:
        new_name = data['formula_id'].strip()
        if new_name:
            measurement.formula_id = new_name

    measurement.edit_ip = request.remote_addr
    measurement.edit_date = datetime.now(UTC).isoformat()

    db.session.commit()
    return jsonify({"message": "Updated successfully"}), 200


@api_bp.route('/measurements/<int:measurement_id>', methods=['DELETE'])
def delete_measurement(measurement_id):
    """Delete a measurement and its draft."""
    success, error = check_lock()
    if not success:
        return jsonify({"error": f"Permission denied: {error}"}), 403

    m = db.session.get(Measurement, measurement_id)
    if not m:
        return jsonify({"error": "Measurement not found"}), 404

    if not m.is_draft:
        # Also delete any associated draft
        draft = Measurement.query.filter_by(original_id=m.pkey, is_draft=True).first()
        if draft:
            db.session.delete(draft)
        db.session.delete(m)
    else:
        # If we are deleting a draft specifically
        db.session.delete(m)

    db.session.commit()
    return jsonify({"message": "Deleted"}), 200


@api_bp.route('/measurements/<int:measurement_id>/points', methods=['POST'])
def add_point(measurement_id):
    """Add a point to a measurement."""
    success, error = check_lock()
    if not success:
        return jsonify({"error": f"Permission denied: {error}"}), 403

    measurement = get_best_measurement(measurement_id)
    if not measurement:
        return jsonify({"error": "Measurement not found"}), 404

    factor = SPINDLE_ID2FACTOR.get(measurement.spindle_id)
    if not factor:
        return jsonify({"error": "Select a valid spindle first"}), 400

    data = request.get_json()
    try:
        N, eta = float(data['N']), float(data['eta'])
        torque = float(data['torque']) if data.get('torque') else None
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid numbers"}), 400

    sr = factor * N
    ss = eta * sr * 0.001
    new_p = Point(N=N, eta=eta, torque=torque, shear_rate=sr, shear_stress=ss,
                  is_draft=measurement.is_draft, measurement=measurement)
    db.session.add(new_p)

    measurement.edit_ip = request.remote_addr
    measurement.edit_date = datetime.now(UTC).isoformat()

    db.session.commit()
    return jsonify({"id": new_p.id, "shear_rate": sr, "shear_stress": ss}), 201


@api_bp.route('/measurements/<int:measurement_id>/points/<int:point_id>', methods=['DELETE'])
def delete_point(measurement_id, point_id):
    """Delete a point."""
    success, error = check_lock()
    if not success:
        return jsonify({"error": f"Permission denied: {error}"}), 403

    measurement = get_best_measurement(measurement_id)
    if not measurement:
        return jsonify({"error": "Measurement not found"}), 404

    point = Point.query.filter_by(id=point_id, measurement_pkey=measurement.pkey).first()
    if not point:
        return jsonify({"error": "Point not found"}), 404

    db.session.delete(point)

    measurement.edit_ip = request.remote_addr
    measurement.edit_date = datetime.now(UTC).isoformat()

    db.session.commit()
    return jsonify({"message": "Point deleted"}), 200


@api_bp.route('/measurements/<int:measurement_id>/points/<int:point_id>', methods=['PUT'])
def update_point(measurement_id, point_id):
    """Update a point."""
    success, error = check_lock()
    if not success:
        return jsonify({"error": f"Permission denied: {error}"}), 403

    measurement = get_best_measurement(measurement_id)
    if not measurement:
        return jsonify({"error": "Measurement not found"}), 404

    point = Point.query.filter_by(id=point_id, measurement_pkey=measurement.pkey).first()
    if not point:
        return jsonify({"error": "Point not found"}), 404

    data = request.get_json()
    if 'N' in data:
        point.N = float(data['N'])
    if 'eta' in data:
        point.eta = float(data['eta'])
    if 'torque' in data:
        point.torque = float(data['torque']) if data['torque'] else None

    factor = SPINDLE_ID2FACTOR.get(measurement.spindle_id)
    if factor:
        point.shear_rate = factor * point.N
        point.shear_stress = point.eta * point.shear_rate * 0.001
    else:
        point.shear_rate = point.shear_stress = None

    measurement.edit_ip = request.remote_addr
    measurement.edit_date = datetime.now(UTC).isoformat()

    db.session.commit()
    return jsonify({
        "shear_rate": point.shear_rate,
        "shear_stress": point.shear_stress}), 200
