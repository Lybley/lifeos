"""
Workflow Orchestrator
Coordinates multi-step workflows between agents
"""
import asyncio
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
import uuid
import asyncpg
from message_bus import AgentBus
from message_schemas import (
    RequestMessage, ResponseMessage, EventMessage, EscalationMessage,
    MessageType, EscalationType, MessagePriority
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class WorkflowStep:
    """Represents a single step in a workflow"""
    def __init__(self, step_def: Dict[str, Any]):
        self.id = step_def['id']
        self.name = step_def['name']
        self.agent = step_def['agent']
        self.action = step_def['action']
        self.depends_on = step_def.get('depends_on', [])
        self.timeout_seconds = step_def.get('timeout_seconds', 60)
        self.retry = step_def.get('retry', 0)
        self.input_mapping = step_def.get('input_mapping', {})
        self.output_mapping = step_def.get('output_mapping', {})

class WorkflowOrchestrator:
    """
    Orchestrates multi-step workflows involving multiple agents
    """
    
    def __init__(self, bus: AgentBus, db_pool: asyncpg.Pool):
        self.bus = bus
        self.db_pool = db_pool
        self.agent_id = "orchestrator"
        
        # Active executions
        self.executions: Dict[str, asyncio.Task] = {}
    
    async def start(self):
        """Start the orchestrator"""
        # Subscribe to orchestrator topics
        await self.bus.subscribe([
            f"agent.{self.agent_id}.request",
            "event.*"
        ])
        
        # Register handlers
        self.bus.register_handler(
            f"agent.{self.agent_id}.request",
            self._handle_workflow_request
        )
        
        logger.info("Orchestrator started")
    
    async def execute_workflow(
        self,
        workflow_id: str,
        context_data: Dict[str, Any],
        user_id: Optional[str] = None
    ) -> str:
        """
        Execute a workflow
        Returns: execution_id
        """
        # Load workflow definition
        workflow = await self._load_workflow(workflow_id)
        if not workflow:
            raise ValueError(f"Workflow not found: {workflow_id}")
        
        # Create execution record
        execution_id = str(uuid.uuid4())
        trace_id = str(uuid.uuid4())
        
        await self._create_execution_record(
            execution_id,
            workflow_id,
            context_data,
            user_id,
            trace_id
        )
        
        # Start execution in background
        task = asyncio.create_task(
            self._run_workflow(execution_id, workflow, context_data, trace_id)
        )
        self.executions[execution_id] = task
        
        logger.info(f"Started workflow execution: {execution_id}")
        return execution_id
    
    async def _run_workflow(
        self,
        execution_id: str,
        workflow: Dict[str, Any],
        context: Dict[str, Any],
        trace_id: str
    ):
        """
        Execute workflow steps
        """
        steps = [WorkflowStep(step_def) for step_def in workflow['steps']]
        completed_steps = set()
        failed_steps = set()
        step_outputs = {}
        
        try:
            # Update status to running
            await self._update_execution_status(execution_id, "running")
            
            while len(completed_steps) < len(steps):
                # Find steps ready to execute
                ready_steps = [
                    step for step in steps
                    if step.id not in completed_steps
                    and step.id not in failed_steps
                    and all(dep in completed_steps for dep in step.depends_on)
                ]
                
                if not ready_steps:
                    # No more steps can be executed
                    if failed_steps:
                        raise Exception(f"Workflow blocked by failed steps: {failed_steps}")
                    break
                
                # Execute ready steps in parallel
                tasks = [
                    self._execute_step(
                        execution_id,
                        step,
                        context,
                        step_outputs,
                        trace_id
                    )
                    for step in ready_steps
                ]
                
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                # Process results
                for step, result in zip(ready_steps, results):
                    if isinstance(result, Exception):
                        logger.error(f"Step {step.id} failed: {result}")
                        failed_steps.add(step.id)
                        
                        # Try retry
                        if step.retry > 0:
                            logger.info(f"Retrying step {step.id}...")
                            step.retry -= 1
                        else:
                            # Escalate
                            await self._escalate_step_failure(
                                execution_id,
                                step,
                                str(result),
                                trace_id
                            )
                    else:
                        logger.info(f"Step {step.id} completed successfully")
                        completed_steps.add(step.id)
                        step_outputs[step.id] = result
                        
                        # Update step execution record
                        await self._update_step_execution(
                            execution_id,
                            step.id,
                            "completed",
                            result
                        )
            
            # Workflow completed
            final_result = {
                "completed_steps": list(completed_steps),
                "failed_steps": list(failed_steps),
                "outputs": step_outputs
            }
            
            await self._complete_execution(
                execution_id,
                "completed" if not failed_steps else "failed",
                final_result
            )
            
            # Publish completion event
            await self.bus.publish(EventMessage(
                from_agent_id=self.agent_id,
                topic="event.workflow.completed",
                event_type="workflow_completed",
                event_data={
                    "execution_id": execution_id,
                    "workflow_id": workflow['workflow_id'],
                    "status": "completed" if not failed_steps else "failed",
                    "completed_steps": len(completed_steps),
                    "total_steps": len(steps)
                },
                trace_id=trace_id
            ))
            
        except Exception as e:
            logger.error(f"Workflow execution failed: {e}")
            await self._complete_execution(
                execution_id,
                "failed",
                {"error": str(e)}
            )
    
    async def _execute_step(
        self,
        execution_id: str,
        step: WorkflowStep,
        context: Dict[str, Any],
        step_outputs: Dict[str, Any],
        trace_id: str
    ) -> Dict[str, Any]:
        """
        Execute a single workflow step
        """
        logger.info(f"Executing step: {step.id} ({step.name}) with agent {step.agent}\")\n        \n        # Create step execution record\n        await self._create_step_execution(execution_id, step)\n        \n        # Prepare input data\n        input_data = {}\n        for key, mapping in step.input_mapping.items():\n            if mapping.startswith('context.'):\n                input_data[key] = context.get(mapping[8:])\n            elif mapping.startswith('step.'):\n                step_id, output_key = mapping[5:].split('.', 1)\n                input_data[key] = step_outputs.get(step_id, {}).get(output_key)\n            else:\n                input_data[key] = mapping\n        \n        # Create request message\n        request = RequestMessage(\n            from_agent_id=self.agent_id,\n            to_agent_id=step.agent,\n            topic=f\"agent.{step.agent}.request\",\n            action=step.action,\n            parameters=input_data,\n            response_timeout_seconds=step.timeout_seconds,\n            trace_id=trace_id,\n            conversation_id=execution_id\n        )\n        \n        # Send request and wait for response\n        response = await self.bus.request(request, timeout=step.timeout_seconds)\n        \n        if not response.success:\n            raise Exception(f\"Step failed: {response.error}\")\n        \n        # Apply output mapping\n        output_data = response.result or {}\n        mapped_output = {}\n        for output_key, target_key in step.output_mapping.items():\n            if output_key in output_data:\n                mapped_output[target_key] = output_data[output_key]\n        \n        return mapped_output or output_data\n    \n    async def _escalate_step_failure(\n        self,\n        execution_id: str,\n        step: WorkflowStep,\n        error: str,\n        trace_id: str\n    ):\n        \"\"\"Escalate step failure\"\"\"\n        escalation_id = str(uuid.uuid4())\n        \n        # Create escalation message\n        escalation = EscalationMessage(\n            from_agent_id=self.agent_id,\n            to_agent_id=\"human-supervisor\",\n            topic=\"escalation.step_failure\",\n            escalation_type=EscalationType.ERROR,\n            reason=f\"Step '{step.name}' failed after {step.retry + 1} attempts\",\n            severity=\"high\",\n            failed_action=step.action,\n            error_details={\"error\": error, \"step\": step.id},\n            requires_human=True,\n            trace_id=trace_id\n        )\n        \n        await self.bus.publish(escalation)\n        \n        # Log escalation\n        async with self.db_pool.acquire() as conn:\n            await conn.execute(\n                \"\"\"\n                INSERT INTO agent_escalations (\n                    escalation_id, execution_id, from_agent_id,\n                    escalation_type, reason, severity, status\n                ) VALUES ($1, $2, $3, $4, $5, $6, 'open')\n                \"\"\",\n                escalation_id,\n                execution_id,\n                step.agent,\n                \"error\",\n                escalation.reason,\n                escalation.severity\n            )\n    \n    async def _handle_workflow_request(self, message: RequestMessage):\n        \"\"\"Handle incoming workflow execution requests\"\"\"\n        try:\n            if message.action == \"execute_workflow\":\n                workflow_id = message.parameters.get('workflow_id')\n                context_data = message.parameters.get('context', {})\n                user_id = message.parameters.get('user_id')\n                \n                execution_id = await self.execute_workflow(\n                    workflow_id,\n                    context_data,\n                    user_id\n                )\n                \n                # Send response\n                response = ResponseMessage(\n                    from_agent_id=self.agent_id,\n                    to_agent_id=message.from_agent_id,\n                    topic=message.topic.replace(\".request\", \".response\"),\n                    correlation_id=message.message_id,\n                    success=True,\n                    result={\"execution_id\": execution_id},\n                    conversation_id=message.conversation_id,\n                    trace_id=message.trace_id\n                )\n                await self.bus.publish(response)\n        \n        except Exception as e:\n            logger.error(f\"Error handling workflow request: {e}\")\n            # Send error response\n            response = ResponseMessage(\n                from_agent_id=self.agent_id,\n                to_agent_id=message.from_agent_id,\n                topic=message.topic.replace(\".request\", \".response\"),\n                correlation_id=message.message_id,\n                success=False,\n                error=str(e),\n                trace_id=message.trace_id\n            )\n            await self.bus.publish(response)\n    \n    # Database helpers\n    \n    async def _load_workflow(self, workflow_id: str) -> Optional[Dict]:\n        async with self.db_pool.acquire() as conn:\n            row = await conn.fetchrow(\n                \"SELECT * FROM workflows WHERE workflow_id = $1 AND is_active = true\",\n                workflow_id\n            )\n            if row:\n                return dict(row)\n        return None\n    \n    async def _create_execution_record(\n        self,\n        execution_id: str,\n        workflow_id: str,\n        context_data: Dict,\n        user_id: Optional[str],\n        trace_id: str\n    ):\n        async with self.db_pool.acquire() as conn:\n            # Get workflow steps\n            workflow = await self._load_workflow(workflow_id)\n            steps = [step['id'] for step in workflow['steps']]\n            \n            await conn.execute(\n                \"\"\"\n                INSERT INTO workflow_executions (\n                    execution_id, workflow_id, user_id, current_step,\n                    status, context_data, pending_steps\n                ) VALUES ($1, $2, $3, $4, $5, $6, $7)\n                \"\"\",\n                execution_id,\n                workflow_id,\n                user_id,\n                steps[0] if steps else None,\n                \"pending\",\n                json.dumps(context_data),\n                steps\n            )\n    \n    async def _create_step_execution(\n        self,\n        execution_id: str,\n        step: WorkflowStep\n    ):\n        async with self.db_pool.acquire() as conn:\n            await conn.execute(\n                \"\"\"\n                INSERT INTO workflow_step_executions (\n                    execution_id, step_id, step_name, agent_id,\n                    status, started_at\n                ) VALUES ($1, $2, $3, $4, 'running', NOW())\n                \"\"\",\n                execution_id,\n                step.id,\n                step.name,\n                step.agent\n            )\n    \n    async def _update_step_execution(\n        self,\n        execution_id: str,\n        step_id: str,\n        status: str,\n        output_data: Optional[Dict] = None\n    ):\n        async with self.db_pool.acquire() as conn:\n            await conn.execute(\n                \"\"\"\n                UPDATE workflow_step_executions\n                SET status = $1, output_data = $2, completed_at = NOW(),\n                    duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000\n                WHERE execution_id = $3 AND step_id = $4\n                \"\"\",\n                status,\n                json.dumps(output_data) if output_data else None,\n                execution_id,\n                step_id\n            )\n    \n    async def _update_execution_status(self, execution_id: str, status: str):\n        async with self.db_pool.acquire() as conn:\n            await conn.execute(\n                \"UPDATE workflow_executions SET status = $1, current_step = $2 WHERE execution_id = $3\",\n                status,\n                None,\n                execution_id\n            )\n    \n    async def _complete_execution(\n        self,\n        execution_id: str,\n        status: str,\n        result: Dict\n    ):\n        async with self.db_pool.acquire() as conn:\n            await conn.execute(\n                \"\"\"\n                UPDATE workflow_executions\n                SET status = $1, result = $2, completed_at = NOW(),\n                    duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000\n                WHERE execution_id = $3\n                \"\"\",\n                status,\n                json.dumps(result),\n                execution_id\n            )\n