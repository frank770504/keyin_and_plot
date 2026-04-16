from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, UTC

db = SQLAlchemy()


class GlobalLock(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_name = db.Column(db.String(100), nullable=False)
    session_id = db.Column(db.String(100), nullable=False, unique=True)
    last_heartbeat = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(UTC).replace(tzinfo=None))

    def is_stale(self, timeout_seconds=120):
        now = datetime.now(UTC).replace(tzinfo=None)
        return (now - self.last_heartbeat).total_seconds() > timeout_seconds


class Dataset(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=False, nullable=False)
    date = db.Column(db.String(20), nullable=True)
    serial_id = db.Column(db.String(100), nullable=True)
    spindle_id = db.Column(db.String(50), nullable=True)
    is_draft = db.Column(db.Boolean, default=False)
    original_id = db.Column(db.Integer, nullable=True)
    # Draft-related session columns removed
    points = db.relationship('Point', backref='dataset', cascade="all, delete-orphan", lazy=True)

    def __repr__(self):
        return f'<Dataset {self.name} (Draft: {self.is_draft})>'


class Point(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    N = db.Column(db.Float, nullable=False)
    eta = db.Column(db.Float, nullable=False)
    torque = db.Column(db.Float, nullable=True)
    shear_rate = db.Column(db.Float, nullable=True)
    shear_stress = db.Column(db.Float, nullable=True)
    is_draft = db.Column(db.Boolean, default=False)
    original_id = db.Column(db.Integer, nullable=True)
    dataset_id = db.Column(db.Integer, db.ForeignKey('dataset.id'), nullable=False)

    def __repr__(self):
        return f'<Point(N={self.N}, eta={self.eta})>'
