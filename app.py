
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
        return jsonify({"error": "Dataset with this name already exists"}), 409 # 409 Conflict

    datasets[dataset_name] = []
    print(f"Created new dataset: '{dataset_name}'") # Server-side log
    return jsonify({"message": f"Dataset '{dataset_name}' created successfully"}), 201 # 201 Created


if __name__ == '__main__':
    # Using a different port to avoid conflicts with the old http.server
    app.run(debug=True, port=5001)
