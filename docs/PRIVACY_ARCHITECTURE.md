# LifeOS Privacy Architecture

## Overview

LifeOS implements a **privacy-first, multi-tier encryption model** that gives users full control over their data security level. From standard encryption to zero-knowledge architecture, we ensure your personal memory graph remains private.

## Encryption Tiers

### Tier 1: Standard (Default) - Server-Managed Encryption
**Target Audience**: All users  
**Security Level**: High  
**Use Case**: General data protection

**Architecture:**
- Data encrypted at rest using AES-256-GCM
- Encryption keys managed by AWS KMS / Google Cloud KMS
- Keys rotated automatically every 90 days
- Database-level encryption for PostgreSQL/MongoDB
- TLS 1.3 for data in transit

**Key Features:**
- ✅ Zero-configuration security
- ✅ Automatic key rotation
- ✅ Point-in-time recovery
- ✅ Compliant with SOC 2, ISO 27001

**Threat Protection:**
- ✅ Physical server compromise
- ✅ Database breach
- ✅ Backup theft
- ⚠️ Insider threat (admin access possible)
- ❌ Legal subpoena (we can decrypt)

---

### Tier 2: Premium - Zero-Knowledge Encryption
**Target Audience**: Privacy-conscious users  
**Security Level**: Very High  
**Use Case**: Full end-to-end encryption

**Architecture:**
- All data encrypted client-side before upload
- User-held master key derived from passphrase
- Server never sees plaintext or encryption keys
- Uses libsodium (XChaCha20-Poly1305)
- Key derivation: Argon2id (memory-hard)

**Key Features:**
- ✅ Zero-knowledge: server can't read your data
- ✅ User controls encryption keys
- ✅ Optional key escrow for recovery
- ✅ Searchable encryption for metadata

**Threat Protection:**
- ✅ Physical server compromise
- ✅ Database breach
- ✅ Insider threat
- ✅ Legal subpoena (we can't decrypt)
- ⚠️ Passphrase loss = data loss (unless escrowed)

---

### Tier 3: Vault - Selective Zero-Knowledge
**Target Audience**: All users  
**Security Level**: Hybrid  
**Use Case**: Mark sensitive nodes for client-side encryption

**Architecture:**
- Most data uses Tier 1 (server-managed)
- Sensitive nodes marked with `is_vault: true`
- Vault nodes encrypted client-side with per-user vault key
- Vault key stored encrypted in browser (IndexedDB)
- Vault key never transmitted to server

**Key Features:**
- ✅ Best of both worlds (usability + security)
- ✅ Selective encryption for PII, credentials, etc.
- ✅ Search works on non-vault nodes
- ✅ Easy to upgrade/downgrade nodes

**Threat Protection:**
- ✅ Sensitive data protected from server
- ✅ Regular data remains searchable
- ✅ Granular control per node
- ⚠️ Need to mark nodes as sensitive manually

---

## Key Management

### Standard Tier (KMS)
```
User Data → Encrypt with DEK → Store in Database
                ↓
            DEK encrypted with KEK (KMS)
                ↓
            KEK rotated every 90 days
```

### Zero-Knowledge Tier
```
User Passphrase → Argon2id → Master Key (never sent to server)
                                ↓
                    Encrypt all data client-side
                                ↓
                    Upload encrypted blobs to server
```

### Vault Tier
```
Regular Node → Server-managed encryption (Tier 1)
Vault Node → Client-side encryption with vault key
                ↓
            Vault Key stored in IndexedDB (encrypted)
                ↓
            Unlock vault with biometric/PIN
```

---

## Data Flow Diagrams

### Write Flow (Vault Node)
```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │ 1. Create node
       │ 2. Mark as vault
       │ 3. Encrypt with vault key
       ▼
┌─────────────┐
│   Encrypt   │
│ (libsodium) │
└──────┬──────┘
       │ Encrypted blob
       ▼
┌─────────────┐
│   Server    │
│  (API)      │
└──────┬──────┘
       │ Store encrypted
       ▼
┌─────────────┐
│  Database   │
│ (PostgreSQL)│
└─────────────┘
```

### Read Flow (Vault Node)
```
┌─────────────┐
│  Database   │
└──────┬──────┘
       │ Fetch encrypted blob
       ▼
┌─────────────┐
│   Server    │
└──────┬──────┘
       │ Return encrypted data
       ▼
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ Decrypt with vault key
       ▼
┌─────────────┐
│   Display   │
│  (Plaintext)│
└─────────────┘
```

---

## Threat Model

### Threats Addressed

#### 1. **Database Breach** (Critical)
**Threat**: Attacker gains access to database dump  
**Mitigation**:
- Tier 1: Encrypted at rest (KMS keys not in dump)
- Tier 2/3: Encrypted client-side (attacker gets ciphertext)
- **Result**: ✅ Data unreadable without keys

#### 2. **Malicious Insider** (High)
**Threat**: Rogue employee with database access  
**Mitigation**:
- Tier 1: Admin can access (trust required)
- Tier 2/3: Admin cannot decrypt (zero-knowledge)
- Audit logging of all access attempts
- **Result**: ✅ Tier 2/3 protected, Tier 1 requires trust

#### 3. **Legal Subpoena** (High)
**Threat**: Government requests user data  
**Mitigation**:
- Tier 1: We must comply (can decrypt)
- Tier 2/3: We provide encrypted data (cannot decrypt)
- Transparency reports published quarterly
- **Result**: ✅ Tier 2/3 users protected

#### 4. **Man-in-the-Middle** (Medium)
**Threat**: Network eavesdropping  
**Mitigation**:
- TLS 1.3 with certificate pinning
- HSTS enabled
- No mixed content
- **Result**: ✅ All tiers protected

#### 5. **XSS Attack** (High)
**Threat**: Malicious script in browser  
**Mitigation**:
- CSP (Content Security Policy) strict
- HttpOnly cookies for auth
- Vault keys in encrypted IndexedDB (not localStorage)
- DOMPurify for user content
- **Result**: ✅ Reduced attack surface

#### 6. **Supply Chain Attack** (Critical)
**Threat**: Compromised npm package  
**Mitigation**:
- Subresource Integrity (SRI) for CDN assets
- Dependency scanning (Snyk, Dependabot)
- Lock file verification
- **Result**: ⚠️ Monitoring + response plan

#### 7. **Passphrase Loss** (Medium)
**Threat**: User forgets zero-knowledge passphrase  
**Mitigation**:
- Optional key escrow (encrypted with recovery key)
- Recovery codes (one-time use)
- Clear warnings about data loss
- **Result**: ⚠️ User responsibility with safety nets

#### 8. **Physical Device Theft** (Medium)
**Threat**: Stolen laptop/phone with unlocked app  
**Mitigation**:
- Session timeout (15 min default)
- Biometric re-auth for vault access
- Remote device wipe API
- **Result**: ✅ Time-limited exposure

---

## Security Controls

### Authentication
- ✅ Argon2id password hashing (memory-hard)
- ✅ Rate limiting (5 attempts, 1-hour lockout)
- ✅ 2FA support (TOTP, WebAuthn)
- ✅ Device fingerprinting
- ✅ Suspicious login alerts

### Authorization
- ✅ Row-level security (PostgreSQL RLS)
- ✅ JWT with short expiry (15 min)
- ✅ Refresh tokens (httpOnly, secure)
- ✅ Scope-based permissions

### Monitoring
- ✅ Failed login alerts
- ✅ Data export alerts
- ✅ Vault access logging
- ✅ Anomaly detection (ML-based)

---

## GDPR Compliance

### Right to Access (Art. 15)
**API**: `GET /api/v1/privacy/export`
- Returns all user data in JSON format
- Includes metadata, timestamps, IP logs
- Delivered via secure download link

### Right to Erasure (Art. 17)
**API**: `DELETE /api/v1/privacy/delete-account`
- Soft delete (30-day grace period)
- Hard delete after 30 days (irreversible)
- Cascade deletes all related data

### Right to Data Portability (Art. 20)
**API**: `GET /api/v1/privacy/export?format=json|csv`
- Machine-readable format
- Includes decryption keys (if applicable)

### Audit Trail
**API**: `GET /api/v1/privacy/audit-logs`
- All data access events
- Retention: 2 years
- Immutable logging

---

## Implementation Checklist

### Phase 1: Standard Encryption (✅ Implemented)
- [x] KMS integration (AWS/GCP)
- [x] Database encryption at rest
- [x] TLS 1.3 enforcement
- [x] Key rotation automation

### Phase 2: Zero-Knowledge (In Progress)
- [ ] Client-side encryption library
- [ ] Key derivation (Argon2id)
- [ ] Encrypted upload/download flows
- [ ] Recovery mechanism

### Phase 3: Vault Feature (In Progress)
- [ ] Vault key generation
- [ ] Node marking UI
- [ ] Selective encryption
- [ ] Biometric unlock

### Phase 4: GDPR APIs (In Progress)
- [ ] Data export endpoint
- [ ] Account deletion endpoint
- [ ] Audit log API
- [ ] Automated compliance reports

---

## Security Incident Response

### Detection
1. Automated alerts for anomalies
2. Security dashboard monitoring
3. User-reported issues

### Response
1. **< 1 hour**: Incident triage
2. **< 4 hours**: Root cause analysis
3. **< 24 hours**: Patch deployed
4. **< 72 hours**: User notification (if affected)

### Post-Incident
1. Forensic analysis
2. Security audit
3. Transparency report update
4. Process improvements

---

## Performance Considerations

### Standard Encryption
- ✅ No client-side overhead
- ✅ Fast database queries
- ✅ Full-text search enabled

### Zero-Knowledge Encryption
- ⚠️ Encryption overhead: ~10ms/node
- ⚠️ Decryption overhead: ~10ms/node
- ❌ Server-side search disabled (client-side only)

### Vault Encryption
- ✅ Minimal overhead (selective)
- ✅ Non-vault nodes searchable
- ⚠️ Vault nodes require client-side decryption

---

## Compliance Certifications (Roadmap)

- [ ] SOC 2 Type II
- [ ] ISO 27001
- [ ] GDPR (EU)
- [ ] CCPA (California)
- [ ] HIPAA (Healthcare - optional)

---

## Open Source & Audits

- ✅ Encryption libraries: libsodium (open source)
- ✅ Frontend code: Available for review
- [ ] Security audit: Scheduled Q2 2025
- [ ] Bug bounty program: Launching Q1 2025

---

## Contact

**Security Issues**: security@lifeos.ai  
**Privacy Questions**: privacy@lifeos.ai  
**DPO (Data Protection Officer)**: dpo@lifeos.ai

**Response Time**: < 24 hours for critical issues
