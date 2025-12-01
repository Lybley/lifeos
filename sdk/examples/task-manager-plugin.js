/**
 * Sample LifeOS Plugin: Task Manager Agent
 * 
 * This plugin demonstrates:
 * - Agent registration
 * - Event subscription (task-extracted events)
 * - PMG node creation
 * - Webhook handling
 */

const express = require('express');
const LifeOSSDK = require('../nodejs/lifeos-sdk');

// Configuration
const CONFIG = {
  apiUrl: process.env.LIFEOS_API_URL || 'http://localhost:8000',
  clientId: process.env.LIFEOS_CLIENT_ID,
  clientSecret: process.env.LIFEOS_CLIENT_SECRET,
  redirectUri: process.env.LIFEOS_REDIRECT_URI || 'http://localhost:3001/oauth/callback',
  webhookPort: process.env.WEBHOOK_PORT || 3001,
  webhookSecret: process.env.WEBHOOK_SECRET || 'your-webhook-secret',
};

// Initialize SDK
const sdk = new LifeOSSDK({
  apiUrl: CONFIG.apiUrl,
  clientId: CONFIG.clientId,
  clientSecret: CONFIG.clientSecret,
  redirectUri: CONFIG.redirectUri,
});

// Plugin state
let agentId = null;
let accessToken = null;

// ============================================================================
// AGENT REGISTRATION
// ============================================================================

async function registerAgent() {
  try {
    console.log('📝 Registering Task Manager Agent...');
    
    const agent = await sdk.registerAgent({
      name: 'Task Manager Agent',
      description: 'Automatically manages and organizes tasks extracted from conversations',
      version: '1.0.0',
      capabilities: [
        'task-extraction',
        'task-organization',
        'deadline-tracking',
        'priority-management',
      ],
      endpoints: {
        webhook: `http://localhost:${CONFIG.webhookPort}/webhook`,
        health: `http://localhost:${CONFIG.webhookPort}/health`,
      },
      metadata: {
        author: 'Your Name',
        repository: 'https://github.com/yourname/task-manager-plugin',
      },
    });
    
    agentId = agent.agent_id;
    console.log(`✅ Agent registered successfully! ID: ${agentId}`);
    
    // Subscribe to task-extracted events
    await sdk.subscribeToEvents(agentId, ['task-extracted', 'task-updated', 'task-completed']);
    console.log('✅ Subscribed to task events');
    
    return agent;
  } catch (error) {
    console.error('❌ Agent registration failed:', error.message);
    throw error;
  }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Handle task-extracted event
 * Creates a task node in the PMG and sets up organization
 */
async function handleTaskExtracted(event) {
  console.log('📥 Received task-extracted event:', event);
  
  try {
    const taskData = event.payload;
    
    // Create task node in PMG
    const taskNode = await sdk.createNode({
      type: 'task',
      content: {
        title: taskData.title,
        description: taskData.description,
        status: 'pending',
        priority: taskData.priority || 'medium',
        deadline: taskData.deadline,
        created_from: taskData.source,
      },
      metadata: {
        extracted_at: new Date().toISOString(),
        confidence: taskData.confidence,
        agent_id: agentId,
      },
      tags: ['task', 'auto-extracted', taskData.priority || 'medium'],
    });
    
    console.log(`✅ Created task node: ${taskNode.id}`);
    
    // If there's a related document, create relationship
    if (taskData.source_document_id) {
      await sdk.createRelationship(
        taskNode.id,
        taskData.source_document_id,
        'extracted_from'
      );
      console.log('✅ Linked task to source document');
    }
    
    // Organize task by deadline
    if (taskData.deadline) {
      await organizeTasks();
    }
    
    // Send confirmation event
    await sdk.sendEvent({
      type: 'task-organized',
      payload: {
        task_id: taskNode.id,
        title: taskData.title,
        status: 'organized',
      },
      userId: event.user_id,
    });
    
    return { success: true, task_id: taskNode.id };
  } catch (error) {
    console.error('❌ Failed to handle task-extracted event:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Handle task-updated event
 */
async function handleTaskUpdated(event) {
  console.log('📥 Received task-updated event:', event);
  
  try {
    const { task_id, updates } = event.payload;
    
    // Update the task node
    await sdk.updateNode(task_id, {
      content: updates,
      metadata: {
        ...updates.metadata,
        last_updated: new Date().toISOString(),
        updated_by: 'task-manager-agent',
      },
    });
    
    console.log(`✅ Updated task: ${task_id}`);
    
    // Re-organize if deadline or priority changed
    if (updates.deadline || updates.priority) {
      await organizeTasks();
    }
    
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to handle task-updated event:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Handle task-completed event
 */
async function handleTaskCompleted(event) {
  console.log('📥 Received task-completed event:', event);
  
  try {
    const { task_id } = event.payload;
    
    // Update task status
    await sdk.updateNode(task_id, {
      content: {
        status: 'completed',
        completed_at: new Date().toISOString(),
      },
    });
    
    console.log(`✅ Marked task as completed: ${task_id}`);
    
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to handle task-completed event:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Organize tasks by priority and deadline
 */
async function organizeTasks() {
  try {
    // Query all pending tasks
    const tasks = await sdk.queryNodes({
      type: 'task',
      limit: 100,
    });
    
    // Filter pending tasks
    const pendingTasks = tasks.filter(
      (task) => task.content.status === 'pending'
    );
    
    // Sort by deadline and priority
    const sortedTasks = pendingTasks.sort((a, b) => {
      // First by deadline
      if (a.content.deadline && b.content.deadline) {
        const dateA = new Date(a.content.deadline);
        const dateB = new Date(b.content.deadline);
        if (dateA < dateB) return -1;
        if (dateA > dateB) return 1;
      }
      
      // Then by priority
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityA = priorityOrder[a.content.priority] || 2;
      const priorityB = priorityOrder[b.content.priority] || 2;
      return priorityB - priorityA;
    });
    
    console.log(`✅ Organized ${sortedTasks.length} tasks`);
    
    return sortedTasks;
  } catch (error) {
    console.error('❌ Failed to organize tasks:', error.message);
  }
}

// ============================================================================
// WEBHOOK SERVER
// ============================================================================

const app = express();
app.use(express.json());
app.use(express.text({ type: 'application/json' }));

/**
 * Webhook endpoint for receiving events from LifeOS
 */
app.post('/webhook', async (req, res) => {
  try {
    // Verify webhook signature
    const signature = req.headers['x-lifeos-signature'];
    const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    
    if (!sdk.verifyWebhookSignature(payload, signature, CONFIG.webhookSecret)) {
      console.error('❌ Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    
    console.log(`📨 Webhook received: ${event.type}`);
    
    // Route to appropriate handler
    let result;
    switch (event.type) {
      case 'task-extracted':
        result = await handleTaskExtracted(event);
        break;
      case 'task-updated':
        result = await handleTaskUpdated(event);
        break;
      case 'task-completed':
        result = await handleTaskCompleted(event);
        break;
      default:
        console.log(`⚠️ Unhandled event type: ${event.type}`);
        result = { success: true, message: 'Event type not handled' };
    }
    
    res.json(result);
  } catch (error) {
    console.error('❌ Webhook error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    agent_id: agentId,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * OAuth callback endpoint
 */
app.get('/oauth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.status(400).send('Missing authorization code');
    }
    
    // Exchange code for token
    const tokenData = await sdk.getAccessToken(code);
    accessToken = tokenData.access_token;
    
    console.log('✅ OAuth authentication successful');
    
    // Register agent after authentication
    await registerAgent();
    
    res.send('Authentication successful! You can close this window.');
  } catch (error) {
    console.error('❌ OAuth callback error:', error.message);
    res.status(500).send(`Authentication failed: ${error.message}`);
  }
});

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  try {
    console.log('🚀 Starting Task Manager Plugin...');
    
    // Start webhook server
    app.listen(CONFIG.webhookPort, () => {
      console.log(`✅ Webhook server listening on port ${CONFIG.webhookPort}`);
    });
    
    // Check if we have tokens
    if (process.env.LIFEOS_ACCESS_TOKEN) {
      sdk.setTokens(process.env.LIFEOS_ACCESS_TOKEN, process.env.LIFEOS_REFRESH_TOKEN);
      await registerAgent();
    } else {
      // Start OAuth flow
      const authUrl = sdk.getAuthorizationUrl();
      console.log('\n🔐 Please authorize this plugin:');
      console.log(authUrl);
      console.log('\nWaiting for authorization...\n');
    }
    
    // Send test event after 5 seconds (if registered)
    setTimeout(async () => {
      if (agentId) {
        console.log('📤 Sending test event...');
        try {
          await sdk.sendTestEvent(agentId, {
            type: 'task-extracted',
            payload: {
              title: 'Review Q4 budget proposal',
              description: 'Review and provide feedback on the Q4 budget proposal by Friday',
              priority: 'high',
              deadline: '2025-12-10T17:00:00Z',
              confidence: 0.95,
              source: 'email',
            },
          });
          console.log('✅ Test event sent successfully');
        } catch (error) {
          console.error('❌ Failed to send test event:', error.message);
        }
      }
    }, 5000);
    
  } catch (error) {
    console.error('❌ Plugin startup failed:', error.message);
    process.exit(1);
  }
}

// Handle shutdown gracefully
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down Task Manager Plugin...');
  
  if (agentId) {
    try {
      await sdk.unregisterAgent(agentId);
      console.log('✅ Agent unregistered');
    } catch (error) {
      console.error('❌ Failed to unregister agent:', error.message);
    }
  }
  
  process.exit(0);
});

// Start the plugin
main();

module.exports = { handleTaskExtracted, handleTaskUpdated, handleTaskCompleted };
