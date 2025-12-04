"""
Behavioral Feedback API
Provides endpoints for feedback collection and behavior scoring
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import asyncpg
import os
import json
import logging
from behavior_model import BehaviorScorer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Behavioral Feedback API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection pool
db_pool = None

# ML Model
behavior_scorer = BehaviorScorer()

class FeedbackSubmission(BaseModel):
    user_id: str
    suggestion_type: str
    suggestion_id: str
    suggestion_data: Dict[str, Any]
    context_data: Optional[Dict[str, Any]] = {}
    feedback_type: str  # accept, reject, modify, ignore
    confidence_score: Optional[float] = 0.5
    user_rating: Optional[int] = None
    modified_value: Optional[Dict[str, Any]] = None

class BehaviorScoreRequest(BaseModel):
    user_id: str
    context_type: str
    features: Dict[str, Any]

class BehaviorScoreResponse(BaseModel):
    acceptance_probability: float
    priority_score: float
    confidence_score: float
    adjusted_threshold: float
    recommendation: str

class RetrainingRequest(BaseModel):
    model_name: str = "behavior_scorer"
    trigger_reason: Optional[str] = "manual"
    min_samples: int = 50

@app.on_event("startup")
async def startup():
    global db_pool
    # Create database connection pool
    db_config = {
        'host': os.environ.get('POSTGRES_HOST', 'localhost'),
        'port': int(os.environ.get('POSTGRES_PORT', 5432)),
        'database': os.environ.get('POSTGRES_DB', 'lifeos'),
        'user': os.environ.get('POSTGRES_USER', 'lifeos_user'),
        'password': os.environ.get('POSTGRES_PASSWORD', 'lifeos_secure_password_123')
    }
    db_pool = await asyncpg.create_pool(**db_config, min_size=2, max_size=10)
    logger.info("Database pool created")
    
    # Load active model if exists
    try:
        async with db_pool.acquire() as conn:
            model_info = await conn.fetchrow(
                "SELECT model_path FROM ml_model_versions WHERE model_name = 'behavior_scorer' AND is_active = true ORDER BY created_at DESC LIMIT 1"
            )
            if model_info and os.path.exists(model_info['model_path']):
                behavior_scorer.load_model(model_info['model_path'])
                logger.info(f"Loaded active model from {model_info['model_path']}")
    except Exception as e:
        logger.warning(f"Could not load model: {e}")

@app.on_event("shutdown")
async def shutdown():
    if db_pool:
        await db_pool.close()

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "model_loaded": behavior_scorer.model is not None
    }

@app.post("/feedback")
async def submit_feedback(feedback: FeedbackSubmission, background_tasks: BackgroundTasks):
    """
    Submit user feedback on agent suggestion
    """
    try:
        async with db_pool.acquire() as conn:
            feedback_id = await conn.fetchval(
                """
                INSERT INTO user_feedback (
                    user_id, suggestion_type, suggestion_id, suggestion_data,
                    context_data, feedback_type, confidence_score, user_rating,
                    modified_value, suggested_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
                RETURNING id
                """,
                feedback.user_id,
                feedback.suggestion_type,
                feedback.suggestion_id,
                json.dumps(feedback.suggestion_data),
                json.dumps(feedback.context_data),
                feedback.feedback_type,
                feedback.confidence_score,
                feedback.user_rating,
                json.dumps(feedback.modified_value) if feedback.modified_value else None
            )
        
        # Check if retraining is needed (background task)
        background_tasks.add_task(check_retraining_needed)
        
        return {
            "feedback_id": str(feedback_id),
            "status": "recorded",
            "message": "Feedback recorded successfully"
        }
    except Exception as e:
        logger.error(f"Error submitting feedback: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/score", response_model=BehaviorScoreResponse)
async def get_behavior_score(request: BehaviorScoreRequest):
    """
    Get behavior score for a suggestion
    """
    try:
        # Get user's recent accept rate
        async with db_pool.acquire() as conn:
            recent_stats = await conn.fetchrow(
                """
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN feedback_type = 'accept' THEN 1 ELSE 0 END) as accepts
                FROM user_feedback
                WHERE user_id = $1 
                AND suggested_at > NOW() - INTERVAL '7 days'
                """,
                request.user_id
            )
            
            recent_accept_rate = 0.5
            if recent_stats and recent_stats['total'] > 0:
                recent_accept_rate = recent_stats['accepts'] / recent_stats['total']
        
        # Add recent accept rate to features
        features = {**request.features, 'recent_accept_rate': recent_accept_rate}
        
        # Predict acceptance probability
        acceptance_prob, confidence = behavior_scorer.predict_acceptance(features)
        
        # Adjust priority
        original_priority = behavior_scorer._priority_to_numeric(
            features.get('priority', 'medium')
        )
        adjusted_priority = behavior_scorer.adjust_priority(original_priority, acceptance_prob)
        
        # Calculate adjusted threshold
        # Base threshold is 0.5, adjust based on user's history
        base_threshold = 0.5
        if recent_accept_rate > 0.7:
            adjusted_threshold = base_threshold - 0.1  # Lower threshold for accepting users
        elif recent_accept_rate < 0.3:
            adjusted_threshold = base_threshold + 0.1  # Higher threshold for rejecting users
        else:
            adjusted_threshold = base_threshold
        
        # Generate recommendation
        if acceptance_prob >= adjusted_threshold:
            if confidence > 0.7:
                recommendation = "strongly_recommend"
            else:
                recommendation = "recommend"
        else:
            if confidence > 0.7:
                recommendation = "strongly_discourage"
            else:
                recommendation = "neutral"
        
        # Cache the score
        async with db_pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO behavior_scores (
                    user_id, context_type, context_id, acceptance_probability,
                    priority_score, confidence_score, features, expires_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '1 hour')
                """,
                request.user_id,
                request.context_type,
                request.features.get('context_id'),
                acceptance_prob,
                adjusted_priority,
                confidence,
                json.dumps(features)
            )
        
        return BehaviorScoreResponse(
            acceptance_probability=acceptance_prob,
            priority_score=adjusted_priority,
            confidence_score=confidence,
            adjusted_threshold=adjusted_threshold,
            recommendation=recommendation
        )
    except Exception as e:
        logger.error(f"Error calculating behavior score: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/retrain")
async def trigger_retraining(request: RetrainingRequest, background_tasks: BackgroundTasks):
    """
    Manually trigger model retraining
    """
    background_tasks.add_task(
        retrain_model,
        request.model_name,
        request.trigger_reason,
        request.min_samples
    )
    return {"status": "retraining_started", "message": "Model retraining initiated"}

@app.get("/metrics")
async def get_metrics(days: int = 7):
    """
    Get model performance metrics
    """
    try:
        async with db_pool.acquire() as conn:
            # Get feedback stats
            feedback_stats = await conn.fetchrow(
                """
                SELECT 
                    COUNT(*) as total_feedback,
                    SUM(CASE WHEN feedback_type = 'accept' THEN 1 ELSE 0 END) as accepts,
                    SUM(CASE WHEN feedback_type = 'reject' THEN 1 ELSE 0 END) as rejects,
                    SUM(CASE WHEN feedback_type = 'modify' THEN 1 ELSE 0 END) as modifies,
                    AVG(confidence_score) as avg_confidence
                FROM user_feedback
                WHERE suggested_at > NOW() - INTERVAL '1 day' * $1
                """,
                days
            )
            
            # Get latest model performance
            model_perf = await conn.fetchrow(
                """
                SELECT * FROM model_performance_log
                ORDER BY created_at DESC
                LIMIT 1
                """
            )
            
            # Get active model info
            active_model = await conn.fetchrow(
                """
                SELECT * FROM ml_model_versions
                WHERE is_active = true AND model_name = 'behavior_scorer'
                ORDER BY created_at DESC
                LIMIT 1
                """
            )
            
            return {
                "feedback_stats": dict(feedback_stats) if feedback_stats else {},
                "model_performance": dict(model_perf) if model_perf else {},
                "active_model": dict(active_model) if active_model else {},
                "period_days": days
            }
    except Exception as e:
        logger.error(f"Error fetching metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/drift")
async def check_drift():
    """
    Check for model drift
    """
    try:
        async with db_pool.acquire() as conn:
            # Get recent feedback (last 100 samples)
            recent_feedback = await conn.fetch(
                """
                SELECT * FROM user_feedback
                ORDER BY suggested_at DESC
                LIMIT 100
                """
            )
            
            if len(recent_feedback) < 20:
                return {
                    "drift_detected": False,
                    "message": "Insufficient data for drift detection",
                    "samples": len(recent_feedback)
                }
            
            # Get baseline metrics
            baseline = await conn.fetchrow(
                """
                SELECT metrics FROM ml_model_versions
                WHERE is_active = true AND model_name = 'behavior_scorer'
                ORDER BY created_at DESC
                LIMIT 1
                """
            )
            
            if not baseline:
                return {"drift_detected": False, "message": "No baseline model found"}
            
            # Convert to list of dicts
            feedback_data = [dict(row) for row in recent_feedback]
            baseline_metrics = json.loads(baseline['metrics']) if isinstance(baseline['metrics'], str) else baseline['metrics']
            
            # Detect drift
            drift_info = behavior_scorer.detect_drift(feedback_data, baseline_metrics)
            
            # Log drift detection
            if drift_info['drift_detected']:
                await conn.execute(
                    """
                    INSERT INTO model_performance_log (
                        model_version_id, window_start, window_end,
                        accuracy, feature_drift_detected, concept_drift_detected,
                        drift_score, performance_below_threshold
                    ) VALUES (
                        (SELECT id FROM ml_model_versions WHERE is_active = true AND model_name = 'behavior_scorer' LIMIT 1),
                        NOW() - INTERVAL '1 day',
                        NOW(),
                        $1, true, true, $2, true
                    )
                    """,
                    drift_info['recent_accuracy'],
                    drift_info['drift_score']
                )
            
            return drift_info
    except Exception as e:
        logger.error(f"Error checking drift: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Background tasks
async def check_retraining_needed():
    """Check if model should be retrained based on feedback count"""
    try:
        async with db_pool.acquire() as conn:
            # Count feedback since last retraining
            last_retrain = await conn.fetchrow(
                """
                SELECT completed_at FROM retraining_jobs
                WHERE model_name = 'behavior_scorer' AND status = 'completed'
                ORDER BY completed_at DESC
                LIMIT 1
                """
            )
            
            cutoff = last_retrain['completed_at'] if last_retrain else datetime.now() - timedelta(days=30)
            
            new_feedback_count = await conn.fetchval(
                "SELECT COUNT(*) FROM user_feedback WHERE suggested_at > $1",
                cutoff
            )
            
            # Retrain if we have 100+ new feedback samples
            if new_feedback_count >= 100:
                logger.info(f"Triggering retraining: {new_feedback_count} new samples")
                await retrain_model('behavior_scorer', 'automatic_threshold', 100)
    except Exception as e:
        logger.error(f"Error checking retraining: {e}")

async def retrain_model(model_name: str, trigger_reason: str, min_samples: int):
    """Retrain the ML model"""
    job_id = None
    try:
        async with db_pool.acquire() as conn:
            # Create job record
            job_id = await conn.fetchval(
                """
                INSERT INTO retraining_jobs (model_name, job_type, status, triggered_by, trigger_reason, started_at)
                VALUES ($1, 'scheduled', 'running', 'system', $2, NOW())
                RETURNING id
                """,
                model_name,
                trigger_reason
            )
            
            # Fetch training data
            feedback_data = await conn.fetch(
                "SELECT * FROM user_feedback ORDER BY suggested_at DESC LIMIT 1000"
            )
            
            if len(feedback_data) < min_samples:
                await conn.execute(
                    "UPDATE retraining_jobs SET status = 'failed', error_message = $1, completed_at = NOW() WHERE id = $2",
                    f"Insufficient data: {len(feedback_data)} samples",
                    job_id
                )
                return
            
            # Convert to list of dicts
            training_data = [dict(row) for row in feedback_data]
            
            # Train new model
            new_scorer = BehaviorScorer()
            metrics = new_scorer.train(training_data)
            
            # Save new model
            version = f"v1.0.{datetime.now().strftime('%Y%m%d%H%M%S')}"
            model_path = f"/app/ml-models/behavior_scorer_{version}.pkl"
            os.makedirs(os.path.dirname(model_path), exist_ok=True)
            new_scorer.save_model(model_path)
            
            # Save model version
            new_model_id = await conn.fetchval(
                """
                INSERT INTO ml_model_versions (
                    model_name, version, algorithm, hyperparameters, feature_names,
                    training_samples, training_duration, metrics, model_path
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING id
                """,
                model_name,
                version,
                'logistic_regression',
                json.dumps({'C': 1.0, 'penalty': 'l2'}),
                new_scorer.feature_names,
                len(training_data),
                metrics['training_duration'],
                json.dumps(metrics),
                model_path
            )
            
            # Calculate improvement
            old_model = await conn.fetchrow(
                "SELECT metrics FROM ml_model_versions WHERE is_active = true AND model_name = $1 ORDER BY created_at DESC LIMIT 1",
                model_name
            )
            
            improvement = 0
            if old_model:
                old_metrics = json.loads(old_model['metrics']) if isinstance(old_model['metrics'], str) else old_model['metrics']
                old_accuracy = old_metrics.get('accuracy', 0)
                new_accuracy = metrics.get('accuracy', 0)
                improvement = ((new_accuracy - old_accuracy) / old_accuracy * 100) if old_accuracy > 0 else 0
            
            # Update job record
            await conn.execute(
                """
                UPDATE retraining_jobs 
                SET status = 'completed', completed_at = NOW(), duration = $1,
                    new_model_version_id = $2, training_samples = $3, performance_improvement = $4
                WHERE id = $5
                """,
                metrics['training_duration'],
                new_model_id,
                len(training_data),
                improvement,
                job_id
            )
            
            # Activate new model if it's better or first model
            if improvement >= 0 or not old_model:
                await conn.execute(
                    "UPDATE ml_model_versions SET is_active = false WHERE model_name = $1",
                    model_name
                )
                await conn.execute(
                    "UPDATE ml_model_versions SET is_active = true, deployed_at = NOW() WHERE id = $1",
                    new_model_id
                )
                
                # Load new model
                global behavior_scorer
                behavior_scorer = new_scorer
                logger.info(f"New model {version} activated with {improvement:.2f}% improvement")
            
    except Exception as e:
        logger.error(f"Retraining failed: {e}")
        if job_id:
            async with db_pool.acquire() as conn:
                await conn.execute(
                    "UPDATE retraining_jobs SET status = 'failed', error_message = $1, completed_at = NOW() WHERE id = $2",
                    str(e),
                    job_id
                )
