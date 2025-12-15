#!/usr/bin/env node
/**
 * Setup Planner data in MongoDB (fallback for unstable PostgreSQL)
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/lifeos';

async function setupPlannerData() {
  console.log('🔧 Setting up Planner Engine data in MongoDB...\n');
  
  const client = new MongoClient(MONGO_URL);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db();
    
    // Create collections
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    // Tasks collection
    if (!collectionNames.includes('planner_tasks')) {
      await db.createCollection('planner_tasks');
      console.log('✅ Created planner_tasks collection');
    }
    
    // Check existing tasks
    const existingTasks = await db.collection('planner_tasks').countDocuments({ user_id: 'test-user-123' });
    console.log(`📊 Existing tasks for test-user-123: ${existingTasks}`);
    
    if (existingTasks === 0) {
      console.log('📝 Inserting sample tasks...');
      
      const sampleTasks = [
        {
          id: 'task-1',
          user_id: 'test-user-123',
          title: 'Complete RAG Pipeline Documentation',
          description: 'Write comprehensive documentation for the RAG system',
          due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          estimated_duration: 120,
          priority: 'high',
          category: 'work',
          requires_focus: true,
          requires_energy: 'high',
          status: 'pending',
          created_at: new Date()
        },
        {
          id: 'task-2',
          user_id: 'test-user-123',
          title: 'Review Pull Requests',
          description: 'Code review for pending PRs',
          due_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
          estimated_duration: 60,
          priority: 'medium',
          category: 'work',
          requires_focus: false,
          requires_energy: 'medium',
          status: 'pending',
          created_at: new Date()
        },
        {
          id: 'task-3',
          user_id: 'test-user-123',
          title: 'Gym Workout',
          description: 'Evening cardio session',
          due_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
          estimated_duration: 60,
          priority: 'low',
          category: 'health',
          requires_focus: false,
          requires_energy: 'medium',
          status: 'pending',
          created_at: new Date()
        },
        {
          id: 'task-4',
          user_id: 'test-user-123',
          title: 'Integrate Python Microservices',
          description: 'Connect Agent Bus and Knowledge services',
          due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          estimated_duration: 90,
          priority: 'high',
          category: 'work',
          requires_focus: true,
          requires_energy: 'high',
          status: 'pending',
          created_at: new Date()
        },
        {
          id: 'task-5',
          user_id: 'test-user-123',
          title: 'Team 1:1 Prep',
          description: 'Prepare agenda for 1:1 meetings',
          due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          estimated_duration: 30,
          priority: 'low',
          category: 'personal',
          requires_focus: false,
          requires_energy: 'low',
          status: 'pending',
          created_at: new Date()
        }
      ];
      
      await db.collection('planner_tasks').insertMany(sampleTasks);
      console.log(`✅ Inserted ${sampleTasks.length} tasks\n`);
    }
    
    // Calendar events
    if (!collectionNames.includes('planner_events')) {
      await db.createCollection('planner_events');
      console.log('✅ Created planner_events collection');
    }
    
    const existingEvents = await db.collection('planner_events').countDocuments({ user_id: 'test-user-123' });
    console.log(`📅 Existing events for test-user-123: ${existingEvents}`);
    
    if (existingEvents === 0) {
      console.log('📅 Inserting sample events...');
      
      const sampleEvents = [
        {
          id: 'event-1',
          user_id: 'test-user-123',
          title: 'Daily Standup',
          start_time: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000),
          end_time: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 10.5 * 60 * 60 * 1000),
          type: 'meeting',
          is_movable: false,
          status: 'confirmed',
          created_at: new Date()
        },
        {
          id: 'event-2',
          user_id: 'test-user-123',
          title: 'Client Presentation',
          start_time: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000),
          end_time: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 15 * 60 * 60 * 1000),
          type: 'meeting',
          is_movable: true,
          status: 'tentative',
          created_at: new Date()
        },
        {
          id: 'event-3',
          user_id: 'test-user-123',
          title: 'Architecture Review',
          start_time: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000),
          end_time: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000),
          type: 'meeting',
          is_movable: false,
          status: 'confirmed',
          created_at: new Date()
        }
      ];
      
      await db.collection('planner_events').insertMany(sampleEvents);
      console.log(`✅ Inserted ${sampleEvents.length} events\n`);
    }
    
    // Energy profiles
    if (!collectionNames.includes('planner_energy_profiles')) {
      await db.createCollection('planner_energy_profiles');
      console.log('✅ Created planner_energy_profiles collection');
    }
    
    const existingProfile = await db.collection('planner_energy_profiles').findOne({ user_id: 'test-user-123' });
    
    if (!existingProfile) {
      console.log('⚡ Creating energy profile...');
      
      await db.collection('planner_energy_profiles').insertOne({
        user_id: 'test-user-123',
        hourly_pattern: {
          monday: [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.4, 0.5, 0.7, 0.9, 0.9, 0.8, 0.6, 0.5, 0.7, 0.7, 0.6, 0.5, 0.4, 0.4, 0.3, 0.3, 0.3, 0.3],
          tuesday: [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.4, 0.5, 0.7, 0.9, 0.9, 0.8, 0.6, 0.5, 0.7, 0.7, 0.6, 0.5, 0.4, 0.4, 0.3, 0.3, 0.3, 0.3],
          wednesday: [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.4, 0.5, 0.7, 0.9, 0.9, 0.8, 0.6, 0.5, 0.7, 0.7, 0.6, 0.5, 0.4, 0.4, 0.3, 0.3, 0.3, 0.3],
          thursday: [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.4, 0.5, 0.7, 0.9, 0.9, 0.8, 0.6, 0.5, 0.7, 0.7, 0.6, 0.5, 0.4, 0.4, 0.3, 0.3, 0.3, 0.3],
          friday: [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.4, 0.5, 0.7, 0.9, 0.9, 0.8, 0.6, 0.5, 0.7, 0.7, 0.6, 0.5, 0.4, 0.4, 0.3, 0.3, 0.3, 0.3],
          saturday: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
          sunday: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]
        },
        preferred_work_start: '09:00',
        preferred_work_end: '17:00',
        typical_sleep_time: '23:00',
        typical_wake_time: '07:00',
        deep_work_capacity: 4,
        max_meetings_per_day: 5,
        created_at: new Date()
      });
      
      console.log('✅ Energy profile created\n');
    }
    
    // Summary
    console.log('📊 Final Data Summary:');
    const taskCount = await db.collection('planner_tasks').countDocuments({ user_id: 'test-user-123' });
    const eventCount = await db.collection('planner_events').countDocuments({ user_id: 'test-user-123' });
    const profileCount = await db.collection('planner_energy_profiles').countDocuments({ user_id: 'test-user-123' });
    
    console.log(`  • Tasks: ${taskCount}`);
    console.log(`  • Events: ${eventCount}`);
    console.log(`  • Profiles: ${profileCount}`);
    
    console.log('\n🎉 Planner data setup complete in MongoDB!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.close();
  }
}

setupPlannerData().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
