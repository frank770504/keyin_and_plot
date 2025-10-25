from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

# In-memory data store (for now)
datasets = {
    "Sample Dataset A": [
        {"x": 1, "y": 5},
        {"x": 2, "y": 8},
    ],
    "Sample Dataset B": [
        {"x": 10, "y": 15},
        {"x": 12, "y": 9},
    ]
}

@app.route('/')
def index():
    """Serve the main HTML file."""
    return render_template('index.html')

# --- API Endpoints ---

@app.route('/api/datasets', methods=['GET'])
def get_datasets():
    """Return a list of all dataset names."""
    return jsonify(list(datasets.keys()))

@app.route('/api/datasets', methods=['POST'])
def create_dataset():
    """Create a new, empty dataset."""
    data = request.get_json()
    if not data or 'name' not in data or not data['name'].strip():
        return jsonify({"error": "Dataset name must be a non-empty string"}), 400

    dataset_name = data['name'].strip()
    if dataset_name in datasets:
        return jsonify({"error": "Dataset with this name already exists"}), 409

    datasets[dataset_name] = []
    print(f"Created new dataset: '{dataset_name}'")
    return jsonify({"message": f"Dataset '{dataset_name}' created successfully"}), 201

@app.route('/api/datasets/<string:name>', methods=['GET'])
def get_dataset(name):
    """Return the points for a specific dataset."""
    if name not in datasets:
        return jsonify({"error": "Dataset not found"}), 404
    return jsonify(datasets[name])

@app.route('/api/datasets/<string:name>', methods=['DELETE'])
def delete_dataset(name):
    """Delete a dataset."""
    if name not in datasets:
        return jsonify({"error": "Dataset not found"}), 404

    del datasets[name]
    print(f"Deleted dataset: '{name}'")
    return jsonify({"message": f"Dataset '{name}' deleted"}), 200

@app.route('/api/datasets/<string:name>/points', methods=['POST'])
def add_point(name):
    """Add a new point to a dataset."""
    if name not in datasets:
        return jsonify({"error": "Dataset not found"}), 404

    data = request.get_json()
    if not data or 'x' not in data or 'y' not in data:
        return jsonify({"error": "Request must include x and y values"}), 400

    try:
        x = float(data['x'])
        y = float(data['y'])
    except (ValueError, TypeError):
        return jsonify({"error": "x and y must be valid numbers"}), 400

    new_point = {"x": x, "y": y}
    datasets[name].append(new_point)
    print(f"Added point {new_point} to dataset '{name}'")
    return jsonify({"message": "Point added successfully"}), 201

@app.route('/api/datasets/<string:name>/points/<int:index>', methods=['DELETE'])
def delete_point(name, index):
    """Delete a point from a dataset by its index."""
    if name not in datasets:
        return jsonify({"error": "Dataset not found"}), 404

    try:
        point_to_delete = datasets[name][index]
        del datasets[name][index]
        print(f"Deleted point {point_to_delete} from dataset '{name}'")
        return jsonify({"message": "Point deleted"}), 200
    except IndexError:
        return jsonify({"error": "Point index out of bounds"}), 404


if __name__ == '__main__':
    app.run(debug=True, port=5001)
