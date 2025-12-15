#!/usr/bin/env node
/**
 * Setup sample data for Planner Engine testing
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'lifeos',
  user: process.env.POSTGRES_USER || 'lifeos_user',
  password: process.env.POSTGRES_PASSWORD,
});

async function setupPlannerData() {
  console.log('🔧 Setting up Planner Engine sample data...\n');
  
  try {
    // Check existing tasks
    const existingTasks = await pool.query(
      "SELECT COUNT(*) as count FROM tasks WHERE user_id = 'test-user-123'"
    );
    
    console.log(`📊 Existing tasks for test-user-123: ${existingTasks.rows[0].count}`);
    
    if (existingTasks.rows[0].count > 0) {
      console.log('✅ Sample tasks already exist. Skipping insertion.\n');
    } else {
      console.log('📝 Inserting sample tasks...');
      
      // Insert sample tasks
      await pool.query(`
        INSERT INTO tasks (user_id, title, description, due_date, estimated_duration, priority, category, requires_focus, requires_energy, status)
        VALUES 
          ($1, $2, $3, NOW() + INTERVAL '2 days', 120, 'high', 'work', true, 'high', 'pending'),
          ($1, $4, $5, NOW() + INTERVAL '1 day', 60, 'medium', 'work', false, 'medium', 'pending'),
          ($1, $6, $7, NOW() + INTERVAL '1 day', 60, 'low', 'health', false, 'medium', 'pending'),
          ($1, $8, $9, NOW() + INTERVAL '3 days', 90, 'high', 'work', true, 'high', 'pending'),
          ($1, $10, $11, NOW() + INTERVAL '2 days', 30, 'low', 'personal', false, 'low', 'pending')
      `, [
        'test-user-123',
        'Complete RAG Pipeline Documentation',
        'Write comprehensive documentation for the RAG system including architecture, API endpoints, and usage examples',
        'Review Pull Requests',
        'Code review for pending PRs in the repository',
        'Gym Workout',
        'Evening cardio and strength training session',
        'Integrate Python Microservices',
        'Connect Agent Bus, Knowledge Expansion, and MLOps services to the main backend',
        'Team 1:1 Meeting Prep',
        'Prepare agenda and notes for upcoming 1:1 meetings'
      ]);
      
      console.log('✅ 5 tasks inserted\n');
    }
    
    // Check calendar events
    const existingEvents = await pool.query(
      "SELECT COUNT(*) as count FROM calendar_events WHERE user_id = 'test-user-123'"
    );
    
    console.log(`📅 Existing calendar events for test-user-123: ${existingEvents.rows[0].count}`);
    
    if (existingEvents.rows[0].count > 0) {
      console.log('✅ Sample events already exist. Skipping insertion.\n');
    } else {
      console.log('📅 Inserting sample calendar events...');
      
      await pool.query(`
        INSERT INTO calendar_events (user_id, title, start_time, end_time, type, is_movable, status, source)
        VALUES 
          ($1, $2, NOW() + INTERVAL '1 day' + INTERVAL '10 hours', NOW() + INTERVAL '1 day' + INTERVAL '10 hours 30 minutes', 'meeting', false, 'confirmed', 'manual'),
          ($1, $3, NOW() + INTERVAL '2 days' + INTERVAL '14 hours', NOW() + INTERVAL '2 days' + INTERVAL '15 hours', 'meeting', true, 'tentative', 'manual'),
          ($1, $4, NOW() + INTERVAL '3 days' + INTERVAL '9 hours', NOW() + INTERVAL '3 days' + INTERVAL '10 hours', 'meeting', false, 'confirmed', 'manual')
      `, [
        'test-user-123',
        'Daily Standup',
        'Client Presentation',
        'Architecture Review'
      ]);
      
      console.log('✅ 3 calendar events inserted\n');
    }
    
    // Check energy profile
    const existingProfile = await pool.query(
      "SELECT * FROM energy_profiles WHERE user_id = 'test-user-123'"
    );
    
    if (existingProfile.rows.length > 0) {
      console.log('✅ Energy profile already exists for test-user-123\n');
    } else {
      console.log('⚡ Creating energy profile...');
      
      await pool.query(`
        INSERT INTO energy_profiles (user_id, hourly_pattern, preferred_work_start, preferred_work_end)
        VALUES (
          $1,
          '{
            "monday": [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.4, 0.5, 0.7, 0.9, 0.9, 0.8, 0.6, 0.5, 0.7, 0.7, 0.6, 0.5, 0.4, 0.4, 0.3, 0.3, 0.3, 0.3],
            "tuesday": [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.4, 0.5, 0.7, 0.9, 0.9, 0.8, 0.6, 0.5, 0.7, 0.7, 0.6, 0.5, 0.4, 0.4, 0.3, 0.3, 0.3, 0.3],
            "wednesday": [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.4, 0.5, 0.7, 0.9, 0.9, 0.8, 0.6, 0.5, 0.7, 0.7, 0.6, 0.5, 0.4, 0.4, 0.3, 0.3, 0.3, 0.3],
            "thursday": [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.4, 0.5, 0.7, 0.9, 0.9, 0.8, 0.6, 0.5, 0.7, 0.7, 0.6, 0.5, 0.4, 0.4, 0.3, 0.3, 0.3, 0.3],
            "friday": [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.4, 0.5, 0.7, 0.9, 0.9, 0.8, 0.6, 0.5, 0.7, 0.7, 0.6, 0.5, 0.4, 0.4, 0.3, 0.3, 0.3, 0.3],
            "saturday": [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
            "sunday": [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]
          }',
          $2,
          $3
        )
      `, ['test-user-123', '09:00', '17:00']);
      
      console.log('✅ Energy profile created\n');
    }
    
    // Verify data
    console.log('📊 Final Data Summary:');
    const taskCount = await pool.query("SELECT COUNT(*) FROM tasks WHERE user_id = 'test-user-123'");
    const eventCount = await pool.query("SELECT COUNT(*) FROM calendar_events WHERE user_id = 'test-user-123'");
    const profileCount = await pool.query("SELECT COUNT(*) FROM energy_profiles WHERE user_id = 'test-user-123'");
    
    console.log(`  • Tasks: ${taskCount.rows[0].count}`);
    console.log(`  • Calendar Events: ${eventCount.rows[0].count}`);
    console.log(`  • Energy Profiles: ${profileCount.rows[0].count}`);
    
    console.log('\n🎉 Planner Engine data setup complete!');
    
  } catch (error) {
    console.error('❌ Error setting up planner data:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

setupPlannerData().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
