"""
Redis-based Agent Message Bus
Handles pub/sub communication between agents
"""
import json
import asyncio
import logging
from typing import Callable, Dict, List, Optional, Any
from datetime import datetime
import redis.asyncio as redis
import asyncpg
from message_schemas import BaseMessage, MessageType, RequestMessage, ResponseMessage

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AgentBus:
    """Redis-based message bus for inter-agent communication"""
    
    def __init__(self, redis_url: str = "redis://localhost:6379", db_pool: Optional[asyncpg.Pool] = None):
        self.redis_url = redis_url
        self.redis_client: Optional[redis.Redis] = None
        self.pubsub: Optional[redis.client.PubSub] = None
        self.db_pool = db_pool
        
        # Message handlers
        self.handlers: Dict[str, List[Callable]] = {}
        
        # Response tracking
        self.pending_responses: Dict[str, asyncio.Future] = {}
        
        # Running flag
        self.running = False
    
    async def connect(self):
        """Connect to Redis"""
        self.redis_client = await redis.from_url(self.redis_url, decode_responses=True)
        self.pubsub = self.redis_client.pubsub()
        logger.info("Connected to Redis message bus")
    
    async def disconnect(self):
        """Disconnect from Redis"""
        self.running = False
        if self.pubsub:
            await self.pubsub.close()
        if self.redis_client:
            await self.redis_client.close()
        logger.info("Disconnected from Redis message bus")
    
    async def publish(self, message: BaseMessage) -> bool:
        """
        Publish message to the bus
        """
        try:
            # Serialize message
            message_json = message.model_dump_json()
            
            # Publish to Redis
            await self.redis_client.publish(message.topic, message_json)
            
            # Log to database
            if self.db_pool:
                await self._log_message(message, "sent")
            
            logger.info(f"Published {message.message_type} to {message.topic}: {message.message_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to publish message: {e}")
            return False
    
    async def subscribe(self, topics: List[str]):
        """
        Subscribe to topics
        """
        await self.pubsub.subscribe(*topics)
        logger.info(f"Subscribed to topics: {topics}")
    
    async def unsubscribe(self, topics: List[str]):
        """Unsubscribe from topics"""
        await self.pubsub.unsubscribe(*topics)
        logger.info(f"Unsubscribed from topics: {topics}")
    
    def register_handler(self, topic: str, handler: Callable):
        """
        Register message handler for a topic
        """
        if topic not in self.handlers:
            self.handlers[topic] = []
        self.handlers[topic].append(handler)
        logger.info(f"Registered handler for topic: {topic}")
    
    async def start_listening(self):
        """
        Start listening for messages (blocking)
        """
        self.running = True
        logger.info("Started listening for messages")
        
        try:
            async for message in self.pubsub.listen():
                if not self.running:
                    break
                
                if message['type'] == 'message':
                    await self._handle_message(message)
        except asyncio.CancelledError:
            logger.info("Listening cancelled")
        except Exception as e:
            logger.error(f"Error in message listener: {e}")
    
    async def _handle_message(self, redis_message: Dict):
        """
        Handle incoming message
        """
        try:
            topic = redis_message['channel']
            data = json.loads(redis_message['data'])
            
            # Determine message type and deserialize
            message_type = MessageType(data.get('message_type'))
            
            # Parse into appropriate message class
            if message_type == MessageType.RESPONSE:
                message = ResponseMessage(**data)
                # Check if this is a response we're waiting for
                if message.correlation_id in self.pending_responses:
                    future = self.pending_responses.pop(message.correlation_id)
                    future.set_result(message)
            else:
                # Generic handling
                message = BaseMessage(**data)
            
            # Log delivery
            if self.db_pool:
                await self._log_message(message, "delivered")
            
            # Call registered handlers
            if topic in self.handlers:
                for handler in self.handlers[topic]:
                    try:
                        await handler(message)
                    except Exception as e:
                        logger.error(f"Handler error for {topic}: {e}")
            
        except Exception as e:
            logger.error(f"Error handling message: {e}")
    
    async def request(
        self, 
        message: RequestMessage, 
        timeout: Optional[float] = None
    ) -> ResponseMessage:
        """
        Send request and wait for response (RPC pattern)
        """
        # Set up response future
        future = asyncio.Future()
        self.pending_responses[message.message_id] = future
        
        # Set correlation ID
        message.correlation_id = message.message_id
        
        # Publish request
        await self.publish(message)
        
        # Wait for response
        timeout_seconds = timeout or message.response_timeout_seconds
        try:
            response = await asyncio.wait_for(future, timeout=timeout_seconds)
            return response
        except asyncio.TimeoutError:
            # Clean up
            self.pending_responses.pop(message.message_id, None)
            # Return timeout response
            return ResponseMessage(
                from_agent_id="system",
                to_agent_id=message.from_agent_id,
                topic=message.topic.replace(".request", ".response"),
                correlation_id=message.message_id,
                success=False,
                error="Request timeout",
                error_code="TIMEOUT"
            )
    
    async def _log_message(self, message: BaseMessage, status: str):
        """
        Log message to database
        """
        try:
            async with self.db_pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO agent_messages (
                        message_id, correlation_id, conversation_id, message_type,
                        topic, from_agent_id, to_agent_id, payload, metadata,
                        status, trace_id, span_id, parent_span_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                    ON CONFLICT (message_id) DO UPDATE SET status = $10
                    """,
                    message.message_id,
                    message.correlation_id,
                    message.conversation_id,
                    message.message_type.value,
                    message.topic,
                    message.from_agent_id,
                    message.to_agent_id,
                    json.dumps(message.model_dump()),
                    json.dumps(message.metadata),
                    status,
                    message.trace_id,
                    message.span_id,
                    message.parent_span_id
                )
        except Exception as e:
            logger.error(f"Failed to log message to database: {e}")
    
    async def get_conversation_history(
        self, 
        conversation_id: str
    ) -> List[Dict[str, Any]]:
        """
        Get all messages in a conversation
        """
        if not self.db_pool:
            return []
        
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT * FROM agent_messages
                WHERE conversation_id = $1
                ORDER BY created_at ASC
                """,
                conversation_id
            )
            return [dict(row) for row in rows]
