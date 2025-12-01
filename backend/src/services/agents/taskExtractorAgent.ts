/**
 * TaskExtractor Agent - Main Implementation
 * Orchestrates task extraction, storage, and preview generation
 */

import { v4 as uuidv4 } from 'uuid';
import { postgresClient } from '../../config/postgres';
import { neo4jDriver } from '../../config/neo4j';
import { getDefaultLLMClient } from '../llm/emergentLlmClient';
import logger from '../../utils/logger';
import {
  TaskInput,
  ExtractedTask,
  buildTaskExtractionPrompt,
  parseTaskExtractionResponse,
  TASK_EXTRACTOR_SYSTEM_PROMPT,
  CONFIDENCE_RULES,
} from './taskExtractorPrompt';

export interface TaskExtractionResult {
  extraction_id: string;
  tasks: ExtractedTask[];
  preview: TaskPreview[];
  metadata: {
    total_tasks: number;
    high_confidence: number;
    requires_confirmation: number;
    auto_accept_count: number;
    source_id: string;
    extracted_at: string;
  };
  accept_changes_payload: AcceptChangesPayload;
}

export interface TaskPreview {
  preview_id: string;
  task_text: string;
  due_date: string | null;
  assignee: string | null;
  confidence: number;
  confidence_label: 'high' | 'medium' | 'low';
  requires_confirmation: boolean;
  context: string | null;
  source_id: string;
}

export interface AcceptChangesPayload {
  extraction_id: string;
  action: 'accept_all' | 'accept_selected' | 'reject_all';
  selected_task_ids?: string[];
}

export interface StoredTask {
  task_id: string;
  task_text: string;
  due_date: string | null;
  assignee: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  confidence: number;
  source_id: string;
  created_at: Date;
  created_by: string;
}

/**
 * Main TaskExtractor Agent
 */
export class TaskExtractorAgent {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Extract tasks from input text
   */
  async extractTasks(input: TaskInput): Promise<TaskExtractionResult> {
    const extractionId = uuidv4();
    const referenceDate = input.metadata.date
      ? new Date(input.metadata.date)
      : new Date();

    logger.info(`Starting task extraction for source: ${input.metadata.source_id}`);\n
    try {
      // Step 1: Build prompt and call LLM
      const userPrompt = buildTaskExtractionPrompt(input, referenceDate);
      const llmClient = getDefaultLLMClient();

      const llmResponse = await llmClient.chat([
        { role: 'system', content: TASK_EXTRACTOR_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ]);

      logger.info(`LLM response received (${llmResponse.usage.totalTokens} tokens)`);

      // Step 2: Parse and validate tasks
      const extractedTasks = parseTaskExtractionResponse(
        llmResponse.content,
        input.metadata.source_id
      );

      logger.info(`Extracted ${extractedTasks.length} tasks`);

      // Step 3: Generate preview
      const preview = this.generatePreview(extractedTasks);

      // Step 4: Calculate metadata
      const highConfidence = extractedTasks.filter(
        (t) => t.confidence >= CONFIDENCE_RULES.HIGH
      ).length;
      const requiresConfirmation = extractedTasks.filter((t) =>
        CONFIDENCE_RULES.requiresHumanConfirmation(t.confidence)
      ).length;
      const autoAcceptCount = extractedTasks.filter(
        (t) => t.confidence >= CONFIDENCE_RULES.autoAcceptThreshold
      ).length;

      // Step 5: Store extraction in temporary table
      await this.storeExtraction(extractionId, extractedTasks, input);

      const result: TaskExtractionResult = {
        extraction_id: extractionId,
        tasks: extractedTasks,
        preview,
        metadata: {
          total_tasks: extractedTasks.length,
          high_confidence: highConfidence,
          requires_confirmation: requiresConfirmation,
          auto_accept_count: autoAcceptCount,
          source_id: input.metadata.source_id,
          extracted_at: new Date().toISOString(),
        },
        accept_changes_payload: {
          extraction_id: extractionId,
          action: 'accept_all',
        },
      };

      logger.info(
        `Task extraction complete: ${extractedTasks.length} tasks, ` +
        `${requiresConfirmation} require confirmation`
      );

      return result;
    } catch (error) {
      logger.error('Task extraction failed:', error);
      throw new Error(`Task extraction failed: ${error}`);
    }
  }

  /**
   * Generate preview for UI
   */
  private generatePreview(tasks: ExtractedTask[]): TaskPreview[] {
    return tasks.map((task) => ({
      preview_id: uuidv4(),
      task_text: task.task_text,
      due_date: task.due_date,
      assignee: task.assignee,
      confidence: task.confidence,
      confidence_label: CONFIDENCE_RULES.getConfidenceLabel(task.confidence),
      requires_confirmation: CONFIDENCE_RULES.requiresHumanConfirmation(task.confidence),
      context: task.context || null,
      source_id: task.source_id,
    }));
  }

  /**
   * Store extraction temporarily before confirmation
   */
  private async storeExtraction(
    extractionId: string,
    tasks: ExtractedTask[],
    input: TaskInput
  ): Promise<void> {
    const query = `
      INSERT INTO task_extractions (
        id, user_id, source_id, source_type,
        tasks, input_metadata, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
    `;

    await postgresClient.query(query, [
      extractionId,
      this.userId,
      input.metadata.source_id,
      input.metadata.source_type || 'unknown',
      JSON.stringify(tasks),
      JSON.stringify(input.metadata),
    ]);

    logger.info(`Stored extraction ${extractionId} with ${tasks.length} tasks`);
  }

  /**
   * Accept changes and persist tasks
   */
  async acceptChanges(
    payload: AcceptChangesPayload
  ): Promise<{ accepted: number; created_task_ids: string[] }> {
    const { extraction_id, action, selected_task_ids } = payload;

    logger.info(`Accepting changes for extraction ${extraction_id}, action: ${action}`);

    try {
      // Retrieve extraction
      const extractionQuery = `
        SELECT tasks, source_id FROM task_extractions
        WHERE id = $1 AND user_id = $2 AND status = 'pending'
      `;
      const extractionResult = await postgresClient.query(extractionQuery, [
        extraction_id,
        this.userId,
      ]);

      if (extractionResult.rows.length === 0) {
        throw new Error('Extraction not found or already processed');
      }

      const allTasks: ExtractedTask[] = extractionResult.rows[0].tasks;
      const sourceId = extractionResult.rows[0].source_id;

      // Determine which tasks to accept
      let tasksToAccept: ExtractedTask[] = [];

      switch (action) {
        case 'accept_all':
          tasksToAccept = allTasks;
          break;
        case 'accept_selected':
          if (!selected_task_ids || selected_task_ids.length === 0) {
            throw new Error('selected_task_ids required for accept_selected action');
          }
          // Match by task_text + confidence (simple matching)
          tasksToAccept = allTasks.filter((task) =>
            selected_task_ids.includes(this.getTaskHash(task))
          );
          break;
        case 'reject_all':
          tasksToAccept = [];
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      // Persist accepted tasks
      const createdTaskIds: string[] = [];

      for (const task of tasksToAccept) {
        const taskId = await this.persistTask(task, sourceId);
        createdTaskIds.push(taskId);
      }

      // Mark extraction as completed
      await postgresClient.query(
        `UPDATE task_extractions SET status = $1, processed_at = NOW() WHERE id = $2`,
        [action === 'reject_all' ? 'rejected' : 'accepted', extraction_id]
      );

      logger.info(
        `Accepted ${createdTaskIds.length} tasks from extraction ${extraction_id}`
      );

      return {
        accepted: createdTaskIds.length,
        created_task_ids: createdTaskIds,
      };
    } catch (error) {
      logger.error('Failed to accept changes:', error);
      throw new Error(`Failed to accept changes: ${error}`);
    }
  }

  /**
   * Persist task to both PostgreSQL and Neo4j
   */
  private async persistTask(task: ExtractedTask, sourceId: string): Promise<string> {
    const taskId = uuidv4();

    // Step 1: Store in PostgreSQL
    await this.storeTaskInPostgres(taskId, task);

    // Step 2: Create Task node in Neo4j
    await this.createTaskNodeInNeo4j(taskId, task, sourceId);

    return taskId;
  }

  /**
   * Store task in PostgreSQL
   */
  private async storeTaskInPostgres(
    taskId: string,
    task: ExtractedTask
  ): Promise<void> {
    const query = `
      INSERT INTO tasks (
        id, user_id, task_text, due_date, assignee,
        status, confidence, source_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
    `;

    await postgresClient.query(query, [
      taskId,
      this.userId,
      task.task_text,
      task.due_date,
      task.assignee,
      'pending',
      task.confidence,
      task.source_id,
    ]);

    logger.info(`Stored task ${taskId} in PostgreSQL`);
  }

  /**
   * Create Task node in Neo4j with relationships
   */
  private async createTaskNodeInNeo4j(
    taskId: string,
    task: ExtractedTask,
    sourceId: string
  ): Promise<void> {
    const session = neo4jDriver.session();

    try {
      // Create Task node
      const createTaskQuery = `
        CREATE (t:Task {
          id: $taskId,
          task_text: $taskText,
          due_date: $dueDate,
          assignee: $assignee,
          status: 'pending',
          confidence: $confidence,
          created_at: datetime(),
          updated_at: datetime()
        })
        RETURN t
      `;

      await session.run(createTaskQuery, {
        taskId,
        taskText: task.task_text,
        dueDate: task.due_date,
        assignee: task.assignee,
        confidence: task.confidence,
      });

      // Link to User
      await session.run(
        `
        MATCH (u:User {id: $userId})
        MATCH (t:Task {id: $taskId})
        CREATE (u)-[:OWNS]->(t)
      `,
        { userId: this.userId, taskId }
      );

      // Link to source (Document, Message, etc.) if exists
      await session.run(
        `
        MATCH (s {id: $sourceId})
        MATCH (t:Task {id: $taskId})
        CREATE (t)-[:EXTRACTED_FROM]->(s)
      `,
        { sourceId, taskId }
      ).catch(() => {
        // Source might not exist in Neo4j, that's okay
        logger.warn(`Source ${sourceId} not found in Neo4j for task ${taskId}`);
      });

      // Link to assignee if Person node exists
      if (task.assignee) {
        await session.run(
          `
          MATCH (p:Person)
          WHERE p.name = $assignee OR p.email = $assignee
          MATCH (t:Task {id: $taskId})
          CREATE (t)-[:ASSIGNED_TO]->(p)
        `,
          { assignee: task.assignee, taskId }
        ).catch(() => {
          // Person might not exist, that's okay
          logger.warn(`Person ${task.assignee} not found in Neo4j`);
        });
      }

      logger.info(`Created Task node ${taskId} in Neo4j`);
    } finally {
      await session.close();
    }
  }

  /**
   * Helper: Generate hash for task matching
   */
  private getTaskHash(task: ExtractedTask): string {
    return `${task.task_text}_${task.confidence}`.toLowerCase();
  }

  /**
   * List pending extractions for user
   */
  async listPendingExtractions(): Promise<any[]> {
    const query = `
      SELECT id, source_id, source_type, tasks, created_at
      FROM task_extractions
      WHERE user_id = $1 AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT 10
    `;

    const result = await postgresClient.query(query, [this.userId]);

    return result.rows.map((row) => ({
      extraction_id: row.id,
      source_id: row.source_id,
      source_type: row.source_type,
      task_count: row.tasks.length,
      created_at: row.created_at,
    }));
  }

  /**
   * Get tasks for user
   */
  async getUserTasks(filters?: {
    status?: string;
    assignee?: string;
    due_before?: string;
  }): Promise<StoredTask[]> {
    let query = `
      SELECT id, task_text, due_date, assignee, status, confidence,
             source_id, created_at
      FROM tasks
      WHERE user_id = $1
    `;

    const params: any[] = [this.userId];
    let paramIndex = 2;

    if (filters?.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters?.assignee) {
      query += ` AND assignee = $${paramIndex}`;
      params.push(filters.assignee);
      paramIndex++;
    }

    if (filters?.due_before) {
      query += ` AND due_date <= $${paramIndex}`;
      params.push(filters.due_before);
      paramIndex++;
    }

    query += ` ORDER BY due_date ASC NULLS LAST, created_at DESC`;

    const result = await postgresClient.query(query, params);

    return result.rows.map((row) => ({
      task_id: row.id,
      task_text: row.task_text,
      due_date: row.due_date,
      assignee: row.assignee,
      status: row.status,
      confidence: row.confidence,
      source_id: row.source_id,
      created_at: row.created_at,
      created_by: this.userId,
    }));
  }
}

/**
 * Create agent instance
 */
export function createTaskExtractorAgent(userId: string): TaskExtractorAgent {
  return new TaskExtractorAgent(userId);
}
