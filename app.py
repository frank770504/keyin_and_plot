from flask import Flask, render_template, jsonify

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


if __name__ == '__main__':
    # Using a different port to avoid conflicts with the old http.server
    app.run(debug=True, port=5001)