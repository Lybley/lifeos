"""
LLM Proxy Service using Emergent Integrations
Provides OpenAI-compatible API for Node.js backend
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uvicorn
import os
import asyncio

# Import will be added after installation
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    EMERGENT_AVAILABLE = True
except ImportError:
    EMERGENT_AVAILABLE = False
    print("Warning: emergentintegrations not installed")

app = FastAPI(title="LLM Proxy Service")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class EmbeddingRequest(BaseModel):
    input: str | List[str]
    model: str = "text-embedding-3-small"

class EmbeddingResponse(BaseModel):
    object: str = "list"
    data: List[Dict[str, Any]]
    model: str
    usage: Dict[str, int]

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatCompletionRequest(BaseModel):
    model: str
    messages: List[ChatMessage]
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 1000
    top_p: Optional[float] = 1.0

class ChatCompletionResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: List[Dict[str, Any]]
    usage: Dict[str, int]

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "emergent_available": EMERGENT_AVAILABLE
    }

@app.post("/v1/embeddings", response_model=EmbeddingResponse)
async def create_embedding(request: EmbeddingRequest):
    """
    Generate embeddings using OpenAI via Emergent proxy
    Note: Currently falls back to mock data until proper integration
    """
    if not EMERGENT_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Emergent integrations not available. Install: pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/"
        )
    
    # For now, return error as embeddings need special handling
    raise HTTPException(
        status_code=501,
        detail="Embeddings not yet implemented in proxy. Use chat completions."
    )

@app.post("/v1/chat/completions", response_model=ChatCompletionResponse)
async def create_chat_completion(request: ChatCompletionRequest):
    """
    Generate chat completion using Emergent LLM Key
    """
    if not EMERGENT_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Emergent integrations not available"
        )
    
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not set")
    
    try:
        # Extract system message and user messages
        system_message = ""
        user_messages = []
        
        for msg in request.messages:
            if msg.role == "system":
                system_message = msg.content
            elif msg.role == "user":
                user_messages.append(msg.content)
        
        # Create chat instance
        chat = LlmChat(
            api_key=api_key,
            session_id=f"proxy-{id(request)}",
            system_message=system_message or "You are a helpful assistant."
        )
        
        # Configure model
        provider = "openai"
        model = request.model
        
        # Map common model names
        model_mapping = {
            "gpt-4": "gpt-5",
            "gpt-4-turbo": "gpt-5",
            "gpt-3.5-turbo": "gpt-5-mini",
        }
        model = model_mapping.get(model, model)
        
        chat.with_model(provider, model)
        
        # Send last user message
        if not user_messages:
            raise HTTPException(status_code=400, detail="No user messages provided")
        
        user_message = UserMessage(text=user_messages[-1])
        response_text = await chat.send_message(user_message)
        
        # Format response
        import time
        return ChatCompletionResponse(
            id=f"chatcmpl-{int(time.time())}",
            created=int(time.time()),
            model=request.model,
            choices=[{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": response_text
                },
                "finish_reason": "stop"
            }],
            usage={
                "prompt_tokens": len(" ".join(user_messages)),
                "completion_tokens": len(response_text),
                "total_tokens": len(" ".join(user_messages)) + len(response_text)
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM error: {str(e)}")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8002))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
