# Key-in and Plot

An interactive web application for managing and visualizing 2D datasets. It provides a multi-column interface to create datasets, add data points, and perform regression analysis.

## Features

*   **Three-Column Layout**: A flexible interface with collapsible sidebars.
    *   **Left Column**: Manage your datasets (create, delete, and select an active dataset).
    *   **Center Column**: A workspace for the active dataset, with tabs for viewing raw data points and for visualizing the data with regression analysis.
    *   **Right Column**: A comparison tool to select and plot multiple datasets and their power law regressions on a single chart.
*   **Data Management**:
    *   Create and delete datasets.
    *   Add and delete (x, y) data points for any dataset.
*   **Analysis and Visualization**:
    *   View scatter plots for individual datasets.
    *   Calculate and display **Linear** and **Power Law** regression lines on the plot for the active dataset.
*   **Comparison View**:
    *   Select multiple datasets to render them on a shared comparison chart.
    *   Automatically displays the power law regression line for each selected dataset in the comparison view.

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

1.  **Start the Flask server:**
    This command uses `uv` to execute the `app.py` script within the project's virtual environment.
    ```bash
    uv run python app.py
    ```

2.  **Access the application:**
    Open your web browser and navigate to:
    [http://127.0.0.1:5001](http://127.0.0.1:5001)
