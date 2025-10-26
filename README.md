# Key-in and Plot

A simple web application for creating and managing multiple datasets of (x, y) coordinates and visualizing them as scatter plots.


## Tech Stack

*   **Backend:** Python 3, Flask
*   **Frontend:** HTML5, CSS, JavaScript
*   **Charting:** Chart.js
*   **Dependency Management:** `uv`

---

## Setup and Installation

Follow these steps to set up and run the project locally.

### Prerequisites

*   `uv` (If you don't have it, run `pip install uv`)

### Installation Steps

1.  **Clone the repository (or ensure you are in the project root directory).**

2.  **Create a virtual environment:**
    This command creates a local `.venv` directory to store the project's dependencies.
    ```bash
    uv venv
    ```

3.  **Install dependencies:**
    This command reads the `pyproject.toml` file and installs Flask into the virtual environment.
    ```bash
    uv pip sync
    ```

## Running the Application

1.  **Start the Flask server:**
    This command uses `uv` to execute the `app.py` script within the project's virtual environment.
    ```bash
    uv run python app.py
    ```

2.  **Access the application:**
    Open your web browser and navigate to:
    [http://127.0.0.1:5001](http://127.0.0.1:5001)
