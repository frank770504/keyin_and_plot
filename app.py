
import os
import argparse
from flask import Flask, render_template, request, session, redirect, url_for
from dotenv import load_dotenv
from models import db
from api import api_bp
from tools import backup_service

load_dotenv()

def create_app():
    app = Flask(__name__)

    # --- Database & Security Configuration ---
    basedir = os.path.abspath(os.path.dirname(__file__))
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'project.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.secret_key = os.environ.get('SECRET_KEY', 'default-dev-key')

    db.init_app(app)  # Initialize db with app

    # Register blueprints
    app.register_blueprint(api_bp, url_prefix='/api')

    @app.route('/')
    def index():
        """Serve the main HTML file."""
        return render_template('index.html')

    @app.route('/admin/login', methods=['GET', 'POST'])
    def admin_login():
        """Serve the login page and handle authentication."""
        if request.method == 'POST':
            password = request.form.get('password')
            correct_password = os.environ.get('ADMIN_PASSWORD')

            if not correct_password:
                return "Admin password not configured on server.", 500

            if password == correct_password:
                session['admin_logged_in'] = True
                return redirect(url_for('admin'))
            else:
                return render_template('login.html', error="Invalid password")

        return render_template('login.html')

    @app.route('/admin/logout')
    def admin_logout():
        """Log out the admin."""
        session.pop('admin_logged_in', None)
        return redirect(url_for('index'))

    @app.route('/admin')
    def admin():
        """Serve the admin area."""
        if not session.get('admin_logged_in'):
            return redirect(url_for('admin_login'))
        return render_template('admin.html')

    return app


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument("--url")
    parser.add_argument("--port")
    args = parser.parse_args()

    main_app = create_app()
    with main_app.app_context():
        db.create_all()

    # Run backup check on startup
    backup_service.check_and_trigger()

    main_app.run(debug=True, host=args.url, port=args.port)
