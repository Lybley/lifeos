"""
Example: Two agents cooperating on scheduling + proposal generation

Demonstrates:
1. Orchestrator coordinates workflow
2. Scheduling agent schedules meeting
3. Proposal agent generates proposal using meeting details
4. Complete message tracing and logging
"""
import asyncio
import asyncpg
import os
import logging
from message_bus import AgentBus
from orchestrator import WorkflowOrchestrator
from agents.scheduling_agent import SchedulingAgent
from agents.proposal_agent import ProposalAgent

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def main():
    """Run the example workflow"""
    
    # Database connection
    db_pool = await asyncpg.create_pool(
        host=os.getenv('POSTGRES_HOST', 'localhost'),
        port=int(os.getenv('POSTGRES_PORT', 5432)),
        database=os.getenv('POSTGRES_DB', 'lifeos'),
        user=os.getenv('POSTGRES_USER', 'lifeos_user'),
        password=os.getenv('POSTGRES_PASSWORD', 'lifeos_secure_password_123'),
        min_size=2,
        max_size=10
    )
    
    # Create message bus
    bus = AgentBus(redis_url=\"redis://localhost:6379\", db_pool=db_pool)
    await bus.connect()
    
    # Create agents
    scheduling_agent = SchedulingAgent(bus)
    proposal_agent = ProposalAgent(bus)
    orchestrator = WorkflowOrchestrator(bus, db_pool)
    
    # Start all agents
    await scheduling_agent.start()
    await proposal_agent.start()
    await orchestrator.start()
    
    # Start message bus listener in background
    listener_task = asyncio.create_task(bus.start_listening())
    
    logger.info(\"=\"*60)
    logger.info(\"Agent Bus System Started\")
    logger.info(\"=\"*60)
    logger.info(\"Active Agents:\")
    logger.info(\"  - orchestrator: Workflow coordination\")
    logger.info(\"  - scheduling-agent: Meeting scheduling\")
    logger.info(\"  - proposal-agent: Proposal generation\")
    logger.info(\"=\"*60)
    
    # Give agents time to subscribe
    await asyncio.sleep(1)
    
    # === EXAMPLE 1: Execute the workflow ===
    logger.info(\"\\n\" + \"=\"*60)
    logger.info(\"EXAMPLE 1: Lead to Proposal Workflow\")
    logger.info(\"=\"*60)
    
    try:
        # Define workflow context
        context = {
            \"client_name\": \"Acme Corp\",\            \"client_email\": \"contact@acmecorp.com\",\n            \"project_type\": \"Web Application Development\",\n            \"budget_range\": \"$50k-$100k\",\n            \"attendees\": [\n                \"john@example.com\",\n                \"contact@acmecorp.com\"\n            ],\n            \"meeting_duration\": 60\n        }\n        \n        logger.info(f\"Starting workflow with context: {context}\")\n        \n        # Execute workflow\n        execution_id = await orchestrator.execute_workflow(\n            workflow_id=\"lead-to-proposal\",\n            context_data=context,\n            user_id=\"demo-user\"\n        )\n        \n        logger.info(f\"Workflow started: {execution_id}\")\n        \n        # Wait for workflow to complete\n        await asyncio.sleep(5)\n        \n        # Query workflow status\n        async with db_pool.acquire() as conn:\n            execution = await conn.fetchrow(\n                \"SELECT * FROM workflow_executions WHERE execution_id = $1\",\n                execution_id\n            )\n            \n            if execution:\n                logger.info(\"\\nWorkflow Execution Status:\")\n                logger.info(f\"  Status: {execution['status']}\")\n                logger.info(f\"  Completed Steps: {execution['completed_steps']}\")\n                logger.info(f\"  Duration: {execution['duration_ms']}ms\")\n                \n                # Get step details\n                steps = await conn.fetch(\n                    \"SELECT * FROM workflow_step_executions WHERE execution_id = $1 ORDER BY created_at\",\n                    execution_id\n                )\n                \n                logger.info(\"\\nStep-by-Step Execution:\")\n                for step in steps:\n                    logger.info(f\"  {step['step_name']}: {step['status']} ({step['duration_ms']}ms)\")\n        \n        # Get message trace\n        logger.info(\"\\nMessage Trace:\")\n        conversation = await bus.get_conversation_history(execution_id)\n        for i, msg in enumerate(conversation, 1):\n            logger.info(f\"  {i}. [{msg['message_type']}] {msg['from_agent_id']} → {msg['to_agent_id'] or 'broadcast'}\")\n            logger.info(f\"     Topic: {msg['topic']}\")\n            logger.info(f\"     Status: {msg['status']}\")\n    \n    except Exception as e:\n        logger.error(f\"Workflow execution error: {e}\", exc_info=True)\n    \n    # === EXAMPLE 2: Direct agent communication ===\n    logger.info(\"\\n\" + \"=\"*60)\n    logger.info(\"EXAMPLE 2: Direct Agent Communication (Meeting + Proposal)\")\n    logger.info(\"=\"*60)\n    \n    try:\n        from message_schemas import RequestMessage\n        \n        # Step 1: Schedule a meeting\n        logger.info(\"\\nStep 1: Requesting meeting scheduling...\")\n        meeting_request = RequestMessage(\n            from_agent_id=\"demo-client\",\n            to_agent_id=\"scheduling-agent\",\n            topic=\"agent.scheduling-agent.request\",\n            action=\"schedule_meeting\",\n            parameters={\n                \"attendees\": [\"alice@example.com\", \"bob@example.com\"],\n                \"duration_minutes\": 60,\n                \"title\": \"Product Demo\",\n                \"preferred_dates\": [\"2025-12-10\", \"2025-12-11\"]\n            },\n            conversation_id=\"direct-demo\"\n        )\n        \n        meeting_response = await bus.request(meeting_request, timeout=10)\n        \n        if meeting_response.success:\n            logger.info(\"✓ Meeting scheduled successfully!\")\n            logger.info(f\"  Meeting ID: {meeting_response.result['meeting_id']}\")\n            logger.info(f\"  Time: {meeting_response.result['scheduled_time']}\")\n            logger.info(f\"  Link: {meeting_response.result['calendar_link']}\")\n            \n            # Step 2: Generate proposal using meeting details\n            logger.info(\"\\nStep 2: Generating proposal with meeting reference...\")\n            proposal_request = RequestMessage(\n                from_agent_id=\"demo-client\",\n                to_agent_id=\"proposal-agent\",\n                topic=\"agent.proposal-agent.request\",\n                action=\"generate_proposal\",\n                parameters={\n                    \"client_name\": \"Demo Client\",\n                    \"project_type\": \"Mobile App Development\",\n                    \"budget_range\": \"$75k-$125k\",\n                    \"meeting_details\": meeting_response.result\n                },\n                conversation_id=\"direct-demo\"\n            )\n            \n            proposal_response = await bus.request(proposal_request, timeout=10)\n            \n            if proposal_response.success:\n                logger.info(\"✓ Proposal generated successfully!\")\n                logger.info(f\"  Proposal ID: {proposal_response.result['proposal_id']}\")\n                logger.info(f\"  Document: {proposal_response.result['document_url']}\")\n                logger.info(f\"  Sections: {len(proposal_response.result['sections'])}\")\n                logger.info(f\"  Meeting Reference: {proposal_response.result['meeting_reference']}\")\n            else:\n                logger.error(f\"✗ Proposal generation failed: {proposal_response.error}\")\n        else:\n            logger.error(f\"✗ Meeting scheduling failed: {meeting_response.error}\")\n    \n    except Exception as e:\n        logger.error(f\"Direct communication error: {e}\", exc_info=True)\n    \n    # === Statistics ===\n    logger.info(\"\\n\" + \"=\"*60)\n    logger.info(\"System Statistics\")\n    logger.info(\"=\"*60)\n    \n    async with db_pool.acquire() as conn:\n        # Message stats\n        message_stats = await conn.fetchrow(\n            \"\"\"\n            SELECT \n                COUNT(*) as total_messages,\n                COUNT(DISTINCT from_agent_id) as active_agents,\n                COUNT(DISTINCT conversation_id) as conversations,\n                AVG(EXTRACT(EPOCH FROM (processed_at - sent_at)) * 1000) as avg_latency_ms\n            FROM agent_messages\n            WHERE sent_at > NOW() - INTERVAL '1 hour'\n            \"\"\"\n        )\n        \n        logger.info(f\"Total Messages: {message_stats['total_messages']}\")\n        logger.info(f\"Active Agents: {message_stats['active_agents']}\")\n        logger.info(f\"Conversations: {message_stats['conversations']}\")\n        if message_stats['avg_latency_ms']:\n            logger.info(f\"Avg Latency: {message_stats['avg_latency_ms']:.2f}ms\")\n    \n    logger.info(\"\\n\" + \"=\"*60)\n    logger.info(\"Demo Complete! Press Ctrl+C to exit\")\n    logger.info(\"=\"*60)\n    \n    # Keep running\n    try:\n        await asyncio.Future()  # Run forever\n    except asyncio.CancelledError:\n        pass\n    finally:\n        # Cleanup\n        listener_task.cancel()\n        await bus.disconnect()\n        await db_pool.close()\n        logger.info(\"System shut down gracefully\")\n\nif __name__ == \"__main__\":\n    try:\n        asyncio.run(main())\n    except KeyboardInterrupt:\n        logger.info(\"\\nShutdown requested...\")\n