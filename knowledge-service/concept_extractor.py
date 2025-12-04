"""
Concept Extraction Service
Extracts structured concepts, relationships, and rules from documents using LLM
"""
import json
import logging
from typing import Dict, List, Any, Optional
import asyncpg
import uuid
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ConceptExtractor:
    """
    Extracts concepts from documents using LLM
    """
    
    def __init__(self, llm_client, db_pool: asyncpg.Pool):
        self.llm = llm_client
        self.db_pool = db_pool
    
    def get_extraction_prompt(self, text: str, document_context: Dict = None) -> str:
        """
        Generate prompt for concept extraction
        """
        context_str = ""
        if document_context:
            context_str = f"""
Document Context:
- Title: {document_context.get('title', 'Unknown')}
- Type: {document_context.get('type', 'Unknown')}
- Domain: {document_context.get('domain', 'General')}
"""
        
        prompt = f"""
You are a knowledge engineer extracting structured concepts from text.

{context_str}

Text to analyze:
---
{text[:4000]}  
---

Extract the following from the text in JSON format:

1. **Concepts**: Key ideas, entities, processes, or principles
2. **Relationships**: How concepts relate to each other
3. **Rules**: Principles, laws, or heuristics stated or implied

Output format:
{{
  "concepts": [
    {{
      "name": "Concept Name",
      "type": "entity|process|principle|pattern|property",
      "definition": "Clear definition",
      "domain": "field or domain",
      "alternative_names": ["synonym1", "synonym2"],
      "properties": {{"key": "value"}}
    }}
  ],
  "relationships": [
    {{
      "from": "Concept A",
      "to": "Concept B",
      "type": "is_a|part_of|causes|requires|enables|uses|exemplifies",
      "strength": 0.8,
      "context": "Brief explanation"
    }}
  ],
  "rules": [
    {{
      "name": "Rule Name",
      "type": "principle|law|heuristic|best_practice",
      "statement": "Clear statement of the rule",
      "conditions": ["condition1", "condition2"],
      "consequences": ["result1", "result2"],
      "domain": "applicable domain"
    }}
  ]
}}

Guidelines:
- Extract 5-15 key concepts
- Focus on non-trivial, domain-specific concepts
- Avoid obvious or overly general concepts
- Include confidence in relationships (0-1)
- Ensure definitions are self-contained

Output valid JSON only (no markdown, no explanations):
"""
        return prompt
    
    async def extract_from_document(
        self,
        document_id: str,
        text: str,
        document_context: Optional[Dict] = None,
        chunk_size: int = 3000
    ) -> Dict[str, Any]:
        """
        Extract concepts from a document
        """
        logger.info(f"Starting concept extraction for document: {document_id}")
        
        # Create extraction job
        job_id = str(uuid.uuid4())
        await self._create_extraction_job(job_id, document_id)
        
        try:
            # For long documents, process in chunks
            chunks = self._chunk_text(text, chunk_size)
            all_concepts = []
            all_relationships = []
            all_rules = []
            
            for i, chunk in enumerate(chunks):
                logger.info(f"Processing chunk {i+1}/{len(chunks)}")
                
                # Generate prompt
                prompt = self.get_extraction_prompt(chunk, document_context)
                
                # Call LLM
                response = await self._call_llm(prompt)
                
                # Parse response
                extracted = self._parse_llm_response(response)
                
                if extracted:
                    all_concepts.extend(extracted.get('concepts', []))
                    all_relationships.extend(extracted.get('relationships', []))
                    all_rules.extend(extracted.get('rules', []))
            
            # Deduplicate and merge
            concepts = self._deduplicate_concepts(all_concepts)
            relationships = self._deduplicate_relationships(all_relationships)
            rules = self._deduplicate_rules(all_rules)
            
            # Store in database
            await self._store_concepts(concepts, document_id)
            await self._store_relationships(relationships, document_id)
            await self._store_rules(rules, document_id)
            
            # Update job status
            await self._complete_extraction_job(
                job_id,
                len(concepts),
                len(relationships),
                len(rules)
            )
            
            result = {
                "job_id": job_id,
                "document_id": document_id,
                "concepts_extracted": len(concepts),
                "relationships_extracted": len(relationships),
                "rules_extracted": len(rules),
                "concepts": concepts,
                "relationships": relationships,
                "rules": rules
            }
            
            logger.info(f"Extraction complete: {len(concepts)} concepts, {len(relationships)} relationships")
            return result
            
        except Exception as e:
            logger.error(f"Extraction failed: {e}")
            await self._fail_extraction_job(job_id, str(e))
            raise
    
    def _chunk_text(self, text: str, chunk_size: int) -> List[str]:
        """
        Split text into chunks for processing
        """
        words = text.split()
        chunks = []
        current_chunk = []
        current_size = 0
        
        for word in words:
            current_chunk.append(word)
            current_size += len(word) + 1
            
            if current_size >= chunk_size:
                chunks.append(' '.join(current_chunk))
                current_chunk = []
                current_size = 0
        
        if current_chunk:
            chunks.append(' '.join(current_chunk))
        
        return chunks
    
    async def _call_llm(self, prompt: str) -> str:
        """
        Call LLM with prompt
        """
        # This would call your actual LLM (OpenAI, Claude, etc.)
        # For now, mock response
        logger.info("Calling LLM for concept extraction...")
        
        # In real implementation:
        # response = await self.llm.chat.completions.create(
        #     model="gpt-5",
        #     messages=[{"role": "user", "content": prompt}],
        #     temperature=0.3
        # )
        # return response.choices[0].message.content
        
        # Mock response for demo
        mock_response = {
            "concepts": [
                {
                    "name": "Machine Learning",
                    "type": "process",
                    "definition": "A subset of AI that enables systems to learn from data",
                    "domain": "computer_science",
                    "alternative_names": ["ML", "Statistical Learning"],
                    "properties": {"requires_data": True, "automated": True}
                }
            ],
            "relationships": [
                {
                    "from": "Machine Learning",
                    "to": "Artificial Intelligence",
                    "type": "part_of",
                    "strength": 0.9,
                    "context": "ML is a subfield of AI"
                }
            ],
            "rules": [
                {
                    "name": "More Data Generally Improves ML Models",
                    "type": "heuristic",
                    "statement": "Increasing training data typically improves model performance",
                    "conditions": ["Data is relevant", "Data is clean"],
                    "consequences": ["Better generalization", "Reduced overfitting"],
                    "domain": "machine_learning"
                }
            ]
        }
        
        return json.dumps(mock_response)
    
    def _parse_llm_response(self, response: str) -> Optional[Dict]:
        """
        Parse LLM JSON response
        """
        try:
            # Remove markdown code blocks if present
            response = response.strip()
            if response.startswith('```json'):
                response = response[7:]
            if response.startswith('```'):
                response = response[3:]
            if response.endswith('```'):
                response = response[:-3]
            
            parsed = json.loads(response.strip())
            return parsed
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response: {e}")
            logger.error(f"Response: {response[:500]}")
            return None
    
    def _deduplicate_concepts(self, concepts: List[Dict]) -> List[Dict]:
        """
        Remove duplicate concepts
        """
        seen = set()
        unique = []
        
        for concept in concepts:
            name = concept['name'].lower().strip()
            if name not in seen:
                seen.add(name)
                unique.append(concept)
        
        return unique
    
    def _deduplicate_relationships(self, relationships: List[Dict]) -> List[Dict]:
        """
        Remove duplicate relationships
        """
        seen = set()
        unique = []
        
        for rel in relationships:
            key = (rel['from'].lower(), rel['to'].lower(), rel['type'])
            if key not in seen:
                seen.add(key)
                unique.append(rel)
        
        return unique
    
    def _deduplicate_rules(self, rules: List[Dict]) -> List[Dict]:
        """
        Remove duplicate rules
        """
        seen = set()
        unique = []
        
        for rule in rules:
            name = rule['name'].lower().strip()
            if name not in seen:
                seen.add(name)
                unique.append(rule)
        
        return unique
    
    async def _store_concepts(self, concepts: List[Dict], document_id: str):
        """
        Store extracted concepts in database
        """
        async with self.db_pool.acquire() as conn:
            for concept in concepts:
                concept_id = f"concept-{uuid.uuid4().hex[:12]}"
                
                await conn.execute(
                    """
                    INSERT INTO concepts (
                        concept_id, name, concept_type, definition, domain,
                        alternative_names, source_documents, properties
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (concept_id) DO NOTHING
                    """,
                    concept_id,
                    concept['name'],
                    concept.get('type', 'entity'),
                    concept['definition'],
                    concept.get('domain'),
                    concept.get('alternative_names', []),
                    [document_id],
                    json.dumps(concept.get('properties', {}))
                )
    
    async def _store_relationships(self, relationships: List[Dict], document_id: str):
        """
        Store concept relationships
        """
        async with self.db_pool.acquire() as conn:
            for rel in relationships:
                # Get concept IDs by name
                from_concept = await conn.fetchval(
                    "SELECT concept_id FROM concepts WHERE LOWER(name) = LOWER($1) LIMIT 1",
                    rel['from']
                )
                to_concept = await conn.fetchval(
                    "SELECT concept_id FROM concepts WHERE LOWER(name) = LOWER($1) LIMIT 1",
                    rel['to']
                )
                
                if from_concept and to_concept:
                    await conn.execute(
                        """
                        INSERT INTO concept_relationships (
                            from_concept_id, to_concept_id, relationship_type,
                            strength, context, source_document_ids
                        ) VALUES ($1, $2, $3, $4, $5, $6)
                        ON CONFLICT (from_concept_id, to_concept_id, relationship_type) DO NOTHING
                        """,
                        from_concept,
                        to_concept,
                        rel['type'],
                        rel.get('strength', 0.5),
                        rel.get('context'),
                        [document_id]
                    )
    
    async def _store_rules(self, rules: List[Dict], document_id: str):
        """
        Store extracted rules
        """
        async with self.db_pool.acquire() as conn:
            for rule in rules:
                rule_id = f"rule-{uuid.uuid4().hex[:12]}"
                
                await conn.execute(
                    """
                    INSERT INTO knowledge_rules (
                        rule_id, rule_name, rule_type, statement,
                        conditions, consequences, domain, source_documents
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (rule_id) DO NOTHING
                    """,
                    rule_id,
                    rule['name'],
                    rule.get('type', 'principle'),
                    rule['statement'],
                    rule.get('conditions', []),
                    rule.get('consequences', []),
                    rule.get('domain'),
                    [document_id]
                )
    
    async def _create_extraction_job(self, job_id: str, document_id: str):
        async with self.db_pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO concept_extraction_jobs (
                    job_id, document_id, status, started_at
                ) VALUES ($1, $2, 'running', NOW())
                """,
                job_id,
                document_id
            )
    
    async def _complete_extraction_job(
        self,
        job_id: str,
        concepts_found: int,
        relationships_found: int,
        rules_found: int
    ):
        async with self.db_pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE concept_extraction_jobs
                SET status = 'completed', completed_at = NOW(),
                    concepts_found = $1, relationships_found = $2, rules_found = $3,
                    duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))
                WHERE job_id = $4
                """,
                concepts_found,
                relationships_found,
                rules_found,
                job_id
            )
    
    async def _fail_extraction_job(self, job_id: str, error: str):
        async with self.db_pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE concept_extraction_jobs
                SET status = 'failed', error_message = $1, completed_at = NOW()
                WHERE job_id = $2
                """,
                error,
                job_id
            )
