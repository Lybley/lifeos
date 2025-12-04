"""
Behavior Scoring ML Model
Learns from user feedback to predict acceptance probability and adjust priorities
"""
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix
import joblib
import json
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class BehaviorScorer:
    """
    ML model for predicting user behavior and adjusting agent suggestions
    """
    
    def __init__(self, model_path: Optional[str] = None):
        self.model = None
        self.scaler = StandardScaler()
        self.feature_names = [
            'hour_of_day',
            'day_of_week', 
            'task_priority_numeric',
            'user_energy',
            'recent_accept_rate',
            'time_since_last_task',
            'pending_tasks_count',
            'suggested_duration',
            'confidence_score',
            'is_deep_work'
        ]
        
        if model_path:
            self.load_model(model_path)
        else:
            # Initialize baseline model
            self.model = LogisticRegression(C=1.0, penalty='l2', solver='liblinear', random_state=42)
    
    def extract_features(self, feedback_data: List[Dict]) -> pd.DataFrame:
        """
        Extract features from feedback data
        """
        features = []
        
        for item in feedback_data:
            suggestion_data = item.get('suggestion_data', {})
            context_data = item.get('context_data', {})
            
            # Parse times
            suggested_time = suggestion_data.get('suggested_time', datetime.now().isoformat())
            if isinstance(suggested_time, str):
                suggested_time = datetime.fromisoformat(suggested_time.replace('Z', '+00:00'))
            
            feature_dict = {
                'hour_of_day': suggested_time.hour,
                'day_of_week': suggested_time.weekday(),
                'task_priority_numeric': self._priority_to_numeric(suggestion_data.get('priority', 'medium')),
                'user_energy': context_data.get('user_energy', 0.5),
                'recent_accept_rate': context_data.get('recent_accept_rate', 0.5),
                'time_since_last_task': context_data.get('time_since_last_task', 60),
                'pending_tasks_count': context_data.get('pending_tasks', 0),
                'suggested_duration': suggestion_data.get('duration', 60),
                'confidence_score': item.get('confidence_score', 0.5),
                'is_deep_work': 1 if suggestion_data.get('requires_focus', False) else 0
            }
            features.append(feature_dict)
        
        return pd.DataFrame(features)
    
    def _priority_to_numeric(self, priority: str) -> float:
        """Convert priority string to numeric"""
        mapping = {'low': 0.25, 'medium': 0.5, 'high': 0.75, 'urgent': 1.0}
        return mapping.get(priority, 0.5)
    
    def prepare_labels(self, feedback_data: List[Dict]) -> np.ndarray:
        """
        Prepare labels (1 for accept, 0 for reject/modify)
        """
        labels = []
        for item in feedback_data:
            feedback_type = item.get('feedback_type', 'reject')
            # Accept = 1, Reject/Modify/Ignore = 0
            label = 1 if feedback_type == 'accept' else 0
            labels.append(label)
        
        return np.array(labels)
    
    def train(self, feedback_data: List[Dict]) -> Dict:
        """
        Train the model on feedback data
        """
        logger.info(f"Training on {len(feedback_data)} samples")
        
        # Extract features and labels
        X = self.extract_features(feedback_data)
        y = self.prepare_labels(feedback_data)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y if len(np.unique(y)) > 1 else None
        )
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Train model
        start_time = datetime.now()
        self.model.fit(X_train_scaled, y_train)
        training_duration = (datetime.now() - start_time).total_seconds()
        
        # Evaluate
        y_pred = self.model.predict(X_test_scaled)
        
        metrics = {
            'accuracy': float(accuracy_score(y_test, y_pred)),
            'precision': float(precision_score(y_test, y_pred, zero_division=0)),
            'recall': float(recall_score(y_test, y_pred, zero_division=0)),
            'f1': float(f1_score(y_test, y_pred, zero_division=0)),
            'training_samples': len(feedback_data),
            'training_duration': training_duration,
            'confusion_matrix': confusion_matrix(y_test, y_pred).tolist()
        }
        
        logger.info(f"Training completed. Metrics: {metrics}")
        return metrics
    
    def predict_acceptance(self, features: Dict) -> Tuple[float, float]:
        """
        Predict probability of user accepting a suggestion
        Returns: (acceptance_probability, confidence)
        """
        # Convert features to DataFrame
        feature_dict = {
            'hour_of_day': features.get('hour_of_day', 12),
            'day_of_week': features.get('day_of_week', 0),
            'task_priority_numeric': self._priority_to_numeric(features.get('priority', 'medium')),
            'user_energy': features.get('user_energy', 0.5),
            'recent_accept_rate': features.get('recent_accept_rate', 0.5),
            'time_since_last_task': features.get('time_since_last_task', 60),
            'pending_tasks_count': features.get('pending_tasks_count', 0),
            'suggested_duration': features.get('suggested_duration', 60),
            'confidence_score': features.get('confidence_score', 0.5),
            'is_deep_work': 1 if features.get('is_deep_work', False) else 0
        }
        
        X = pd.DataFrame([feature_dict])
        X_scaled = self.scaler.transform(X)
        
        # Get probability
        prob = self.model.predict_proba(X_scaled)[0][1]  # Probability of class 1 (accept)
        
        # Confidence is how far the probability is from 0.5 (decision boundary)
        confidence = abs(prob - 0.5) * 2
        
        return float(prob), float(confidence)
    
    def adjust_priority(self, original_priority: float, acceptance_prob: float) -> float:
        """
        Adjust priority based on predicted acceptance probability
        """
        # If low acceptance probability, reduce priority
        # If high acceptance probability, increase priority
        adjustment_factor = (acceptance_prob - 0.5) * 0.4  # Max ±0.2 adjustment
        adjusted = original_priority + adjustment_factor
        return max(0.0, min(1.0, adjusted))  # Clamp to [0, 1]
    
    def save_model(self, path: str) -> str:
        """
        Save model and scaler to disk
        """
        model_data = {
            'model': self.model,
            'scaler': self.scaler,
            'feature_names': self.feature_names
        }
        joblib.dump(model_data, path)
        logger.info(f"Model saved to {path}")
        return path
    
    def load_model(self, path: str):
        """
        Load model and scaler from disk
        """
        model_data = joblib.load(path)
        self.model = model_data['model']
        self.scaler = model_data['scaler']
        self.feature_names = model_data.get('feature_names', self.feature_names)
        logger.info(f"Model loaded from {path}")
    
    def detect_drift(self, recent_feedback: List[Dict], baseline_metrics: Dict) -> Dict:
        """
        Detect model drift by comparing recent performance to baseline
        """
        # Extract features and labels from recent data
        X_recent = self.extract_features(recent_feedback)
        y_recent = self.prepare_labels(recent_feedback)
        
        # Scale and predict
        X_scaled = self.scaler.transform(X_recent)
        y_pred = self.model.predict(X_scaled)
        
        # Calculate recent metrics
        recent_accuracy = accuracy_score(y_recent, y_pred)
        recent_f1 = f1_score(y_recent, y_pred, zero_division=0)
        
        # Compare with baseline
        baseline_accuracy = baseline_metrics.get('accuracy', 0.7)
        baseline_f1 = baseline_metrics.get('f1', 0.7)
        
        accuracy_drop = baseline_accuracy - recent_accuracy
        f1_drop = baseline_f1 - recent_f1
        
        # Drift detected if performance drops significantly
        drift_detected = accuracy_drop > 0.1 or f1_drop > 0.1
        
        drift_info = {
            'drift_detected': drift_detected,
            'recent_accuracy': float(recent_accuracy),
            'recent_f1': float(recent_f1),
            'baseline_accuracy': float(baseline_accuracy),
            'baseline_f1': float(baseline_f1),
            'accuracy_drop': float(accuracy_drop),
            'f1_drop': float(f1_drop),
            'drift_score': float(max(accuracy_drop, f1_drop))
        }
        
        return drift_info
