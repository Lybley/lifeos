"""
Inter-Agent Message Schemas
Defines standardized message types for agent communication
"""
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from datetime import datetime
import uuid

class MessageType(str, Enum):
    """Message type enumeration"""
    REQUEST = "REQUEST"
    RESPONSE = "RESPONSE"
    EVENT = "EVENT"
    ESCALATION = "ESCALATION"

class MessagePriority(str, Enum):
    """Message priority levels"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"

class EscalationType(str, Enum):
    """Types of escalations"""
    TIMEOUT = "timeout"
    ERROR = "error"
    CONFLICT = "conflict"
    HUMAN_NEEDED = "human_needed"
    RESOURCE_UNAVAILABLE = "resource_unavailable"

class BaseMessage(BaseModel):
    """Base message structure for all agent communications"""
    message_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    message_type: MessageType
    
    # Routing
    from_agent_id: str
    to_agent_id: Optional[str] = None  # None for broadcast
    topic: str
    
    # Correlation
    correlation_id: Optional[str] = None  # Links request/response
    conversation_id: Optional[str] = None  # Groups related messages
    
    # Tracing
    trace_id: Optional[str] = None
    span_id: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4()))
    parent_span_id: Optional[str] = None
    
    # Timing
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    ttl_seconds: Optional[int] = 300  # Time to live
    
    # Priority
    priority: MessagePriority = MessagePriority.NORMAL
    
    # Metadata
    metadata: Dict[str, Any] = Field(default_factory=dict)

class RequestMessage(BaseMessage):
    """
    REQUEST: Agent asks another agent to perform an action
    """
    message_type: MessageType = MessageType.REQUEST
    
    # Request details
    action: str  # What action to perform
    parameters: Dict[str, Any] = Field(default_factory=dict)
    
    # Response expectations
    expect_response: bool = True
    response_timeout_seconds: int = 60
    
    # Retry policy
    max_retries: int = 3
    retry_count: int = 0

    class Config:
        json_schema_extra = {
            "example": {
                "from_agent_id": "orchestrator",
                "to_agent_id": "scheduling-agent",
                "topic": "agent.scheduling.request",
                "action": "schedule_meeting",
                "parameters": {
                    "attendees": ["alice@example.com", "bob@example.com"],
                    "duration_minutes": 60,
                    "preferred_dates": ["2025-12-10", "2025-12-11"]
                }
            }
        }

class ResponseMessage(BaseMessage):
    """
    RESPONSE: Agent responds to a REQUEST
    """
    message_type: MessageType = MessageType.RESPONSE
    
    # Response details
    success: bool
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    error_code: Optional[str] = None
    
    # Processing info
    processing_time_ms: Optional[float] = None

    class Config:
        json_schema_extra = {
            "example": {
                "from_agent_id": "scheduling-agent",
                "to_agent_id": "orchestrator",
                "topic": "agent.scheduling.response",
                "correlation_id": "abc-123",
                "success": True,
                "result": {
                    "meeting_id": "meet-xyz",
                    "scheduled_time": "2025-12-10T14:00:00Z",
                    "calendar_link": "https://cal.example.com/meet-xyz"
                },
                "processing_time_ms": 250.5
            }
        }

class EventMessage(BaseMessage):
    """
    EVENT: Agent broadcasts an event (pub/sub)
    """
    message_type: MessageType = MessageType.EVENT
    
    # Event details
    event_type: str
    event_data: Dict[str, Any] = Field(default_factory=dict)
    
    # Source context
    source_context: Optional[Dict[str, Any]] = None

    class Config:
        json_schema_extra = {
            "example": {
                "from_agent_id": "scheduling-agent",
                "to_agent_id": None,  # Broadcast
                "topic": "event.meeting.scheduled",
                "event_type": "meeting_scheduled",
                "event_data": {
                    "meeting_id": "meet-xyz",
                    "scheduled_time": "2025-12-10T14:00:00Z",
                    "attendees": ["alice@example.com", "bob@example.com"]
                }
            }
        }

class EscalationMessage(BaseMessage):
    """
    ESCALATION: Agent escalates an issue requiring intervention
    """
    message_type: MessageType = MessageType.ESCALATION
    
    # Escalation details
    escalation_type: EscalationType
    reason: str
    severity: str = "medium"  # low, medium, high, critical
    
    # Context
    failed_action: Optional[str] = None
    error_details: Optional[Dict[str, Any]] = None
    attempted_solutions: List[str] = Field(default_factory=list)
    
    # Resolution
    requires_human: bool = False
    suggested_actions: List[str] = Field(default_factory=list)

    class Config:
        json_schema_extra = {
            "example": {
                "from_agent_id": "scheduling-agent",
                "to_agent_id": "orchestrator",
                "topic": "escalation.timeout",
                "escalation_type": "timeout",
                "reason": "Unable to find available time slot after 3 retries",
                "severity": "high",
                "failed_action": "schedule_meeting",
                "requires_human": True,
                "suggested_actions": [
                    "Extend search range to next 2 weeks",
                    "Contact attendees manually"
                ]
            }
        }

# Message factory
def create_message(
    message_type: MessageType,
    from_agent: str,
    to_agent: Optional[str],
    topic: str,
    **kwargs
) -> BaseMessage:
    """Factory function to create typed messages"""
    
    message_classes = {
        MessageType.REQUEST: RequestMessage,
        MessageType.RESPONSE: ResponseMessage,
        MessageType.EVENT: EventMessage,
        MessageType.ESCALATION: EscalationMessage,
    }
    
    message_class = message_classes.get(message_type)
    if not message_class:
        raise ValueError(f"Unknown message type: {message_type}")
    
    return message_class(
        from_agent_id=from_agent,
        to_agent_id=to_agent,
        topic=topic,
        **kwargs
    )
