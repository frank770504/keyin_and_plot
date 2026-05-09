# Key-in and Plot

An interactive web application for managing and visualizing 2D measurements. It provides a multi-column interface to create measurements, add data points, and perform regression analysis.

## Features

*   **Three-Column Layout**: A flexible interface with collapsible sidebars.
    *   **Left Column**: Manage your measurements (create, delete, and select an active measurement).
    *   **Center Column**: A workspace for the active measurement, with tabs for viewing raw data points and for visualizing the data with regression analysis.
    *   **Right Column**: A comparison tool to select and plot multiple measurements and their power law regressions on a single chart.
*   **Data Management**:
    *   Create and delete measurements.
    *   Add and delete (x, y) data points for any measurement.
*   **Analysis and Visualization**:
    *   View scatter plots for individual measurements.
    *   Calculate and display **Linear** and **Power Law** regression lines on the plot for the active measurement.
*   **Comparison View**:
    *   Select multiple measurements to render them on a shared comparison chart.
    *   Automatically displays the power law regression line for each selected measurement in the comparison view.

## Tech Stack

*   **Backend:** Python 3, Flask
*   **Frontend:** HTML5, CSS, JavaScript
*   **Charting:** Chart.js
*   **Dependency Management:** `uv`

## Setup and Installation

Follow these steps to set up and run the project locally.

### Prerequisites

*   `uv` (If you don't have it, run `pip install uv`)

### Installation Steps

1.  **Clone the repository (or ensure you are in the project root directory).**

2.  **Create and sync the Python virtual environment:**
    ```bash
    uv venv
    ```

## Running the Application

1.  **Start the Flask server and setup backups:**
    We provide a launch script that automatically starts the application and ensures the secondary backup cron job is correctly configured.
    ```bash
    ./launch.sh
    ```
    
    Alternatively, to start the Flask server manually:
    ```bash
    uv run python app.py
    ```

2.  **Access the application:**
    Open your web browser and navigate to:
    [http://127.0.0.1:5001](http://127.0.0.1:5001)

## Database Maintenance

The application includes an automated backup system and a manual restore utility to protect your data.

### Automated Backups
- **Frequency**: A backup is automatically created every 24 hours when the application starts.
- **Technology**: Uses atomic snapshots to ensure data integrity even if the app is active.
- **Retention**: Backups are stored in the `backups/` directory and kept for 14 days.

### Manual Restore
If you need to revert the database to a previous state:
1.  **Run the restore utility**:
    ```bash
    uv run python tools/restore_db.py
    ```
2.  **Follow the prompts**: Select a backup from the list. The tool will automatically create a safety copy of your current database before performing the restore.
3.  **Safety First**: Avoid restoring while another user is actively editing (the tool will warn you if a lock is detected).

## API Testing Examples

You can test the backend API using `curl`. Most write operations require an `X-Session-ID` header and the Global Editor Lock.

### 1. Measurements
*   **List Measurements**:
    ```bash
    curl http://127.0.0.1:5001/api/measurements
    ```
*   **Get Single Measurement (Metadata + Points)**:
    ```bash
    curl http://127.0.0.1:5001/api/measurements/1
    ```

### 2. Lock Management
*   **Check Lock Status**:
    ```bash
    curl -H "X-Session-ID: test-session" http://127.0.0.1:5001/api/lock
    ```
*   **Acquire Lock**:
    ```bash
    curl -X POST -H "Content-Type: application/json" \
         -H "X-Session-ID: test-session" \
         -d '{"user_name": "Tester", "session_id": "test-session"}' \
         http://127.0.0.1:5001/api/lock/acquire
    ```

### 3. Editing Workflow (Draft-First)
*   **Start Edit Mode (Create Draft)**:
    ```bash
    curl -X POST -H "X-Session-ID: test-session" \
         http://127.0.0.1:5001/api/measurements/1/edit/start
    ```
*   **Update Draft Metadata**:
    ```bash
    curl -X PUT -H "Content-Type: application/json" \
         -H "X-Session-ID: test-session" \
         -d '{"formula_id": "New Formula Name"}' \
         http://127.0.0.1:5001/api/measurements/1
    ```
*   **Commit Changes**:
    ```bash
    curl -X POST -H "X-Session-ID: test-session" \
         http://127.0.0.1:5001/api/measurements/1/edit/commit
    ```

