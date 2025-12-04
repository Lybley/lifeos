"""
Scheduling Agent
Handles meeting scheduling and calendar operations
"""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any
import sys
sys.path.append('/app/agent-bus')

from message_bus import AgentBus
from message_schemas import RequestMessage, ResponseMessage, EventMessage

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SchedulingAgent:
    """Agent responsible for scheduling meetings"""
    
    def __init__(self, bus: AgentBus):
        self.bus = bus
        self.agent_id = "scheduling-agent"
    
    async def start(self):
        """Start the agent"""
        # Subscribe to scheduling requests
        await self.bus.subscribe([f"agent.{self.agent_id}.request"])
        
        # Register handler
        self.bus.register_handler(
            f"agent.{self.agent_id}.request",
            self._handle_request
        )
        
        logger.info(f"{self.agent_id} started and listening")
    
    async def _handle_request(self, message: RequestMessage):
        """Handle incoming requests"""
        try:
            start_time = datetime.now()
            
            action = message.action
            parameters = message.parameters
            
            # Route to action handler
            if action == "schedule_meeting":
                result = await self._schedule_meeting(parameters)
            elif action == "find_availability":
                result = await self._find_availability(parameters)
            elif action == "send_invites":
                result = await self._send_invites(parameters)
            else:
                raise ValueError(f"Unknown action: {action}")
            
            processing_time = (datetime.now() - start_time).total_seconds() * 1000
            
            # Send success response
            response = ResponseMessage(
                from_agent_id=self.agent_id,
                to_agent_id=message.from_agent_id,
                topic=f"agent.{self.agent_id}.response",
                correlation_id=message.message_id,
                success=True,
                result=result,
                processing_time_ms=processing_time,
                conversation_id=message.conversation_id,
                trace_id=message.trace_id,
                parent_span_id=message.span_id
            )
            await self.bus.publish(response)
            
            # Publish event
            await self._publish_event("meeting_scheduled", result, message.trace_id)
            
        except Exception as e:
            logger.error(f"Error handling request: {e}")
            
            # Send error response
            response = ResponseMessage(
                from_agent_id=self.agent_id,
                to_agent_id=message.from_agent_id,
                topic=f"agent.{self.agent_id}.response",
                correlation_id=message.message_id,
                success=False,
                error=str(e),
                error_code="SCHEDULING_ERROR",
                trace_id=message.trace_id
            )
            await self.bus.publish(response)
    
    async def _schedule_meeting(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """
        Schedule a meeting
        Parameters:
        - attendees: List[str] - Email addresses
        - duration_minutes: int
        - preferred_dates: List[str] - ISO date strings
        - title: str (optional)
        """
        logger.info(f"Scheduling meeting: {parameters}")
        
        attendees = parameters.get('attendees', [])
        duration = parameters.get('duration_minutes', 60)
        preferred_dates = parameters.get('preferred_dates', [])
        title = parameters.get('title', 'Meeting')
        
        # Simulate finding availability
        await asyncio.sleep(0.5)  # Simulate API call
        
        # For demo, schedule 2 days from now at 2 PM
        scheduled_time = datetime.now() + timedelta(days=2)
        scheduled_time = scheduled_time.replace(hour=14, minute=0, second=0, microsecond=0)
        
        meeting_id = f"meet-{scheduled_time.strftime('%Y%m%d%H%M')}"
        
        result = {
            "meeting_id": meeting_id,
            "title": title,
            "scheduled_time": scheduled_time.isoformat(),
            "duration_minutes": duration,
            "attendees": attendees,
            "calendar_link": f"https://calendar.example.com/{meeting_id}",
            "video_link": f"https://zoom.us/{meeting_id}",
            "status": "scheduled"
        }
        
        logger.info(f"Meeting scheduled: {meeting_id} at {scheduled_time}")
        return result
    
    async def _find_availability(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Find available time slots"""
        attendees = parameters.get('attendees', [])
        duration = parameters.get('duration_minutes', 60)
        
        # Simulate availability check
        await asyncio.sleep(0.3)
        
        # Generate mock available slots
        available_slots = []
        for i in range(3):
            slot_time = datetime.now() + timedelta(days=i+1, hours=10)
            available_slots.append({
                "start_time": slot_time.isoformat(),
                "end_time": (slot_time + timedelta(minutes=duration)).isoformat(),
                "confidence": 0.9 - (i * 0.1)
            })
        
        return {
            "available_slots": available_slots,
            "attendees_checked": len(attendees)
        }
    
    async def _send_invites(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Send meeting invites"""
        meeting_id = parameters.get('meeting_id')
        attendees = parameters.get('attendees', [])
        
        # Simulate sending invites
        await asyncio.sleep(0.2)
        
        return {
            "meeting_id": meeting_id,
            "invites_sent": len(attendees),
            "status": "sent"
        }
    
    async def _publish_event(self, event_type: str, data: Dict, trace_id: str):
        """Publish event to the bus"""
        event = EventMessage(
            from_agent_id=self.agent_id,
            topic=f"event.meeting.{event_type}",
            event_type=event_type,
            event_data=data,
            trace_id=trace_id
        )
        await self.bus.publish(event)
