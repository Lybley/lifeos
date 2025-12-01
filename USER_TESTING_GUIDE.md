# LifeOS - User Testing Guide

Welcome to LifeOS! This guide will help you understand how to test and use your personal memory management system.

---

## 🚨 **Current System Status**

**⚠️ IMPORTANT**: The current environment has some infrastructure issues that need to be resolved before full testing:

### Issues Found:
1. **Redis** - Not installed (required for BullMQ job queue)
2. **PostgreSQL** - Not running (required for data storage)
3. **Backend API** - Not running due to missing dependencies

### What's Working:
- ✅ Frontend UI (Next.js on port 3000)
- ✅ MongoDB (running)
- ✅ Auth0 configuration (credentials configured)
- ✅ Google OAuth credentials (configured for Drive & Calendar)

---

## 🔧 **Quick Fix Required**

Before you can test the application, the DevOps team or system administrator needs to:

1. **Install Redis**:
   ```bash
   # For Ubuntu/Debian
   sudo apt-get update
   sudo apt-get install redis-server
   sudo systemctl start redis-server
   sudo systemctl enable redis-server
   ```

2. **Install and Start PostgreSQL**:
   ```bash
   # For Ubuntu/Debian
   sudo apt-get install postgresql postgresql-contrib
   sudo systemctl start postgresql
   sudo systemctl enable postgresql
   
   # Create database
   sudo -u postgres psql -c "CREATE DATABASE lifeos;"
   sudo -u postgres psql -c "CREATE USER lifeos_user WITH ENCRYPTED PASSWORD 'your_password';"
   sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE lifeos TO lifeos_user;"
   ```

3. **Restart Backend**:
   ```bash
   sudo supervisorctl restart backend
   ```

---

## 📱 **What is LifeOS?**

LifeOS is your personal memory management system that:
- 📧 **Ingests data** from Gmail, Google Drive, and Calendar
- 🧠 **Builds a memory graph** connecting all your information
- 💬 **Provides AI-powered chat** to query your memories
- ⚡ **Executes actions** on your behalf (send emails, create calendar events, etc.)
- 🔒 **Protects your privacy** with multi-tier encryption

---

## 🎯 **User Testing Scenarios**

Once the system is running, here's how to test it:

### **Scenario 1: User Onboarding** 🚀

**Goal**: Complete the initial setup flow

**Steps**:
1. **Visit**: `http://localhost:3000` (or your deployment URL)
2. **Click**: "Login" button in top-right
3. **Authenticate**: You'll be redirected to Auth0 login
4. **Create Account**: 
   - Click "Sign Up"
   - Enter email, password
   - Verify email (check your inbox)
5. **Complete Onboarding**:
   - Step 1: Welcome screen
   - Step 2: Connect accounts (Gmail, Drive, Calendar)
   - Step 3: Privacy settings (choose encryption tier)
   - Step 4: Tutorial/walkthrough

**Expected Result**:
- ✅ Redirected to Dashboard after completion
- ✅ Welcome message shows your name
- ✅ Connection count shows "3 Active"

**What to Test**:
- [ ] All onboarding steps load correctly
- [ ] Google account connection works
- [ ] Privacy settings save successfully
- [ ] Dashboard loads after onboarding

---

### **Scenario 2: Connect Google Services** 🔗

**Goal**: Authorize LifeOS to access your Google data

**Steps**:
1. **Navigate to**: Dashboard → "Manage Connections"
2. **Click**: "Connect Gmail"
3. **Authorize**: Allow LifeOS to read your emails
4. **Repeat for**:
   - Google Drive
   - Google Calendar
5. **Check Status**: All should show "Active"

**Expected Result**:
- ✅ OAuth flow completes successfully
- ✅ Connections page shows "Connected" status
- ✅ Data starts syncing in background

**What to Test**:
- [ ] OAuth popup opens correctly
- [ ] Can select Google account
- [ ] Permissions are clear and correct
- [ ] Connection status updates after auth
- [ ] Can disconnect and reconnect

**Test Data Requirements**:
- Use a Google account with some existing:
  - Emails (at least 10-20)
  - Drive files (at least 5-10)
  - Calendar events (upcoming and past)

---

### **Scenario 3: Data Ingestion** 📥

**Goal**: Verify data is being synced from Google services

**Steps**:
1. **Navigate to**: Dashboard
2. **Check**: "Total Memories" counter
3. **Wait**: 5-10 minutes for initial sync
4. **Refresh**: Page to see updated count
5. **Navigate to**: Memory Graph page
6. **View**: Your data nodes

**Expected Result**:
- ✅ Memory count increases over time
- ✅ "Recent Activity" shows ingestion events
- ✅ Memory Graph visualizes your data (if Neo4j installed)

**What to Test**:
- [ ] Memory count increases from 0
- [ ] Recent activity shows sync events
- [ ] Syncs complete without errors
- [ ] Can see email subjects, file names
- [ ] Calendar events appear

**Troubleshooting**:
- If memory count stays at 0 after 10 minutes:
  - Check backend logs: `tail -f /var/log/supervisor/backend.out.log`
  - Verify Google connectors are running
  - Check for API rate limiting errors

---

### **Scenario 4: AI-Powered Chat** 💬

**Goal**: Query your personal memory using natural language

**Steps**:
1. **Navigate to**: Chat page
2. **Ask Questions** (examples):
   - "What meetings do I have this week?"
   - "Show me all documents about Q4 planning"
   - "Who emailed me about the investor meeting?"
   - "Summarize my emails from yesterday"
3. **Check Responses**:
   - Should be contextual
   - Should cite sources (email/file/event)
   - Should be accurate

**Expected Result**:
- ✅ Chat responds within 3-5 seconds
- ✅ Answers are relevant to your data
- ✅ Citations link back to original sources
- ✅ Chat history persists

**What to Test**:
- [ ] Response latency (< 5 seconds)
- [ ] Accuracy of information
- [ ] Citation quality (right source)
- [ ] Handles follow-up questions
- [ ] "I don't know" for unavailable data
- [ ] Chat history shows previous conversations

**Edge Cases to Test**:
- Ask about data that doesn't exist
- Ask ambiguous questions
- Multi-turn conversations
- Very long questions (> 500 words)

---

### **Scenario 5: Action Execution** ⚡

**Goal**: Have LifeOS perform actions on your behalf

**Steps**:
1. **Navigate to**: Actions page
2. **View**: Pending/completed actions
3. **In Chat**: Ask LifeOS to:
   - "Send an email to john@example.com thanking him for the meeting"
   - "Create a calendar event for tomorrow at 3pm titled 'Team sync'"
   - "Remind me to review the proposal in 2 days"
4. **Review**: Action appears in Actions page
5. **Approve/Reject**: Based on your preference
6. **Monitor**: Execution status

**Expected Result**:
- ✅ Action appears in queue within seconds
- ✅ Shows pending status initially
- ✅ After approval, executes successfully
- ✅ Confirmation message in chat

**What to Test**:
- [ ] Actions appear in queue
- [ ] Can approve/reject actions
- [ ] Email actions actually send
- [ ] Calendar events get created
- [ ] Reminders trigger on time
- [ ] Action history is maintained
- [ ] Audit logs show all changes

**Safety Features**:
- Actions should require approval first
- Should show preview before executing
- Can be canceled while pending
- Shows clear success/failure feedback

---

### **Scenario 6: Memory Graph Exploration** 🕸️

**Goal**: Navigate your interconnected data

**Steps**:
1. **Navigate to**: Memory Graph page
2. **View**: Network visualization of your data
3. **Interact**:
   - Click on nodes to see details
   - Zoom in/out
   - Drag nodes around
4. **Filter**:
   - By type (email, file, event, contact)
   - By date range
   - By keyword search
5. **Discover**: Connections between items

**Expected Result** (if Neo4j installed):
- ✅ Graph shows nodes for each data item
- ✅ Edges show relationships
- ✅ Can navigate by clicking
- ✅ Filters work correctly

**⚠️ Note**: If Neo4j is not installed, this page will show a message suggesting to install it later. This is **optional** and not critical for core functionality.

**What to Test**:
- [ ] Graph renders (if Neo4j available)
- [ ] Nodes are clickable
- [ ] Details panel shows metadata
- [ ] Filters reduce displayed nodes
- [ ] Performance with 100+ nodes
- [ ] Search finds relevant nodes

---

### **Scenario 7: Privacy & Data Management** 🔒

**Goal**: Manage your data privacy settings

**Steps**:
1. **Navigate to**: Settings → Privacy
2. **Review**: Current encryption tier
3. **Change Tier**:
   - Basic → Standard → Advanced
4. **Enable Vault**:
   - Toggle vault ON
   - Store sensitive items
5. **Test Vault**:
   - Store a "confidential" memory
   - Try to retrieve it
6. **Data Export**:
   - Click "Export My Data"
   - Download GDPR-compliant export
7. **Data Deletion** (test account only):
   - Request data deletion
   - Verify data is removed

**Expected Result**:
- ✅ Encryption tier changes immediately
- ✅ Vault stores and retrieves data
- ✅ Export generates complete data file
- ✅ Deletion confirms and executes

**What to Test**:
- [ ] Encryption settings save
- [ ] Vault ON/OFF works
- [ ] Can store data in vault
- [ ] Vault data is encrypted
- [ ] Data export completes (< 2 min)
- [ ] Export file is downloadable (JSON)
- [ ] Export contains all your data
- [ ] Deletion request is logged
- [ ] Consent management UI works

---

### **Scenario 8: Real-Time Updates** 🔄

**Goal**: Verify WebSocket connections work

**Steps**:
1. **Open**: Two browser tabs with LifeOS
2. **Tab 1**: Navigate to Chat
3. **Tab 2**: Navigate to Actions
4. **Tab 1**: Send a message that creates an action
5. **Tab 2**: Should see action appear in real-time (no refresh)
6. **Tab 2**: Approve the action
7. **Tab 1**: Should see status update in real-time

**Expected Result**:
- ✅ Action appears in Tab 2 without refresh
- ✅ Status updates appear in Tab 1 without refresh
- ✅ No delay > 2 seconds

**What to Test**:
- [ ] WebSocket connects on page load
- [ ] Real-time action updates
- [ ] Real-time chat notifications
- [ ] Connection survives network interruption
- [ ] Reconnects automatically if disconnected

---

## 🧪 **Performance Testing**

### **Expected Performance Targets**

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| **Page Load Time** | < 2 seconds | < 5 seconds |
| **Chat Response (RAG)** | < 3 seconds (P95) | < 5 seconds |
| **Data Ingestion** | 100 items/min | > 10 items/min |
| **Action Execution** | < 5 seconds | < 10 seconds |
| **API Latency (P95)** | < 500ms | < 1s |

### **How to Test Performance**

1. **Chat Response Time**:
   - Ask 10 questions
   - Time each response
   - Average should be < 3 seconds

2. **Data Sync Speed**:
   - Connect account with 100 emails
   - Time until all appear in memory count
   - Should complete in < 10 minutes

3. **Concurrent Users** (if testing with team):
   - Have 5+ users logged in simultaneously
   - All should have responsive experience
   - No crashes or slowdowns

---

## 🐛 **Bug Reporting Checklist**

When you find an issue, report it with:

1. **Title**: Brief description (e.g., "Chat not responding after 3rd question")
2. **Steps to Reproduce**:
   - Step 1
   - Step 2
   - Step 3
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happened
5. **Environment**:
   - Browser (Chrome 120, Firefox 121, etc.)
   - OS (Mac, Windows, Linux)
   - Screen size (Desktop, Tablet, Mobile)
6. **Screenshots**: If applicable
7. **Console Errors**: Open browser DevTools → Console, copy any red errors

---

## ✅ **Acceptance Criteria**

The system is ready for production when:

- [ ] **Onboarding**: 100% completion rate
- [ ] **Data Ingestion**: All 3 connectors working (Gmail, Drive, Calendar)
- [ ] **Chat**: Responds accurately to at least 8/10 test questions
- [ ] **Actions**: Can create and execute at least 3 action types
- [ ] **Privacy**: Vault and encryption work as expected
- [ ] **Performance**: Meets all performance targets
- [ ] **Stability**: No crashes during 30-minute test session
- [ ] **Mobile**: Core features work on mobile browsers

---

## 🎓 **User Training Materials**

Once testing is complete, users should know:

1. **How to connect their accounts**
2. **How to ask questions in chat**
3. **How to review and approve actions**
4. **How to adjust privacy settings**
5. **How to export their data**
6. **Where to get support**

---

## 📞 **Support Channels**

If you encounter issues during testing:

- **Slack**: #lifeos-support
- **Email**: support@lifeos.io
- **GitHub Issues**: https://github.com/lifeos/platform/issues
- **Documentation**: `/app/docs/`

---

## 🚀 **Next Steps After Testing**

Once testing is complete and all issues are resolved:

1. **Deploy to Kubernetes** (using `/app/k8s/` manifests)
2. **Set up Monitoring** (using `/app/monitoring/` guides)
3. **Configure Alerts** (Slack/PagerDuty)
4. **Beta Launch** with limited users
5. **Iterate** based on feedback

---

**Last Updated**: December 2024  
**Version**: 1.0  
**Status**: Pending Infrastructure Setup
