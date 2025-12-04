"""
Proposal Agent
Generates business proposals and documents
"""
import asyncio
import logging
from datetime import datetime
from typing import Dict, Any
import sys
sys.path.append('/app/agent-bus')

from message_bus import AgentBus
from message_schemas import RequestMessage, ResponseMessage, EventMessage

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ProposalAgent:
    """Agent responsible for generating proposals"""
    
    def __init__(self, bus: AgentBus):
        self.bus = bus
        self.agent_id = "proposal-agent"
    
    async def start(self):
        """Start the agent"""
        # Subscribe to proposal requests
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
            if action == "generate_proposal":
                result = await self._generate_proposal(parameters)
            elif action == "customize_template":
                result = await self._customize_template(parameters)
            elif action == "review_content":
                result = await self._review_content(parameters)
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
            await self._publish_event("proposal_generated", result, message.trace_id)
            
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
                error_code="PROPOSAL_ERROR",
                trace_id=message.trace_id
            )
            await self.bus.publish(response)
    
    async def _generate_proposal(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate a business proposal
        Parameters:
        - client_name: str
        - project_type: str
        - budget_range: str
        - meeting_details: Dict (optional, from scheduling agent)
        """
        logger.info(f"Generating proposal: {parameters}")
        
        client_name = parameters.get('client_name', 'Client')
        project_type = parameters.get('project_type', 'Project')
        budget_range = parameters.get('budget_range', '$10k-$50k')
        meeting_details = parameters.get('meeting_details', {})
        
        # Simulate AI-powered proposal generation
        await asyncio.sleep(1.0)  # Simulate LLM call
        
        proposal_id = f"prop-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        # Generate proposal content
        proposal_content = self._generate_content(
            client_name,
            project_type,
            budget_range,
            meeting_details
        )
        
        result = {
            "proposal_id": proposal_id,
            "client_name": client_name,
            "project_type": project_type,
            "content": proposal_content,
            "sections": [
                "Executive Summary",
                "Project Scope",
                "Timeline",
                "Budget",
                "Team",
                "Next Steps"
            ],
            "status": "draft",
            "generated_at": datetime.now().isoformat(),
            "document_url": f"https://docs.example.com/proposals/{proposal_id}",
            "meeting_reference": meeting_details.get('meeting_id')
        }
        
        logger.info(f"Proposal generated: {proposal_id}")
        return result
    
    def _generate_content(self, client: str, project: str, budget: str, meeting: Dict) -> str:
        """Generate proposal content (simplified)"""
        meeting_ref = ""
        if meeting.get('scheduled_time'):
            meeting_ref = f"\n\nAs discussed in our scheduled meeting on {meeting['scheduled_time']}, "
        
        content = f"""
        # Proposal for {client}
        
        ## Executive Summary
        We are pleased to present this proposal for {project}.{meeting_ref}our team is excited to work with you.
        
        ## Project Scope
        This {project} project will deliver comprehensive solutions tailored to your needs.
        
        ## Timeline
        - Phase 1: Discovery & Planning (2 weeks)
        - Phase 2: Development (6 weeks)
        - Phase 3: Testing & Launch (2 weeks)
        
        ## Budget
        Estimated investment: {budget}
        
        ## Next Steps
        1. Review and approve proposal
        2. Sign contract
        3. Kickoff meeting
        4. Project commencement
        """
        return content
    
    async def _customize_template(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Customize proposal template"""
        template_id = parameters.get('template_id')
        customizations = parameters.get('customizations', {})
        
        await asyncio.sleep(0.3)
        
        return {
            "template_id": template_id,
            "applied_customizations": len(customizations),
            "status": "customized"
        }
    
    async def _review_content(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Review proposal content for quality"""
        proposal_id = parameters.get('proposal_id')
        content = parameters.get('content', '')
        
        await asyncio.sleep(0.5)
        
        # Simple quality check
        word_count = len(content.split())
        has_sections = all(section in content for section in ['Summary', 'Scope', 'Budget'])
        
        return {
            "proposal_id": proposal_id,
            "word_count": word_count,
            "quality_score": 0.85,
            "has_required_sections": has_sections,
            "suggestions": [
                "Add client testimonials",
                "Include case studies"
            ]
        }
    
    async def _publish_event(self, event_type: str, data: Dict, trace_id: str):
        """Publish event to the bus"""
        event = EventMessage(
            from_agent_id=self.agent_id,
            topic=f"event.proposal.{event_type}",
            event_type=event_type,
            event_data=data,
            trace_id=trace_id
        )
        await self.bus.publish(event)
