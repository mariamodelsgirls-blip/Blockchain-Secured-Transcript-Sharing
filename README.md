# 📜 Blockchain-Secured Transcript Sharing

Welcome to a revolutionary way to handle academic transcript sharing for job applications! This project uses the Stacks blockchain and Clarity smart contracts to enable secure, verifiable, and privacy-controlled sharing of educational credentials. Say goodbye to forged documents, slow verification processes, and privacy leaks—students can control who sees their transcripts, institutions can issue tamper-proof records, and employers can instantly verify authenticity without intermediaries.

## ✨ Features

🔒 Tamper-proof transcript storage using hashes for immutability  
🛡️ Privacy controls to grant/revoke access on a per-viewer basis  
📩 Secure sharing requests for job applications with expiration times  
✅ Instant verification for employers without revealing full details  
🏫 Institution-only issuance to prevent fraud  
📊 Audit trails for all accesses and modifications  
💼 Integration-friendly for job platforms via blockchain queries  
🚫 Revocation options for outdated or incorrect transcripts

## 🛠 How It Works

This project solves the real-world problem of inefficient, fraud-prone transcript sharing in job markets. Traditional methods involve mailing physical copies, third-party services with high fees, or email attachments that can be easily altered. Privacy is often compromised as full transcripts are shared indiscriminately. Our blockchain solution ensures transcripts are hashed and stored immutably, with fine-grained access controls, reducing fraud, speeding up hiring, and empowering users with data ownership.

The system involves 8 smart contracts written in Clarity for modularity, security, and scalability:

1. **UserRegistry.clar**: Handles user registration and authentication for students, institutions, and employers.  
2. **InstitutionVerifier.clar**: Verifies and registers educational institutions to ensure only authorized entities can issue transcripts.  
3. **TranscriptIssuer.clar**: Allows verified institutions to issue new transcripts by storing hashes, metadata (e.g., GPA, courses), and issuance timestamps.  
4. **TranscriptStorage.clar**: Securely stores transcript data hashes and basic non-sensitive metadata on-chain for immutability.  
5. **AccessControl.clar**: Manages privacy settings, allowing students to grant/revoke granular access (e.g., view GPA only or full details).  
6. **RequestManager.clar**: Processes sharing requests from employers, including request creation, approval, and expiration.  
7. **VerificationEngine.clar**: Provides public functions for instant verification of transcript authenticity without exposing private data.  
8. **AuditLogger.clar**: Logs all interactions (issuances, accesses, revocations) for transparency and dispute resolution.

**For Students (Transcript Owners)**  
- Register via UserRegistry and link your identity.  
- Receive a transcript hash from your institution via TranscriptIssuer.  
- Use AccessControl to set privacy rules (e.g., share only with specific employers for 30 days).  
- Approve requests through RequestManager and monitor accesses via AuditLogger.

**For Educational Institutions**  
- Get verified in InstitutionVerifier.  
- Issue transcripts using TranscriptIssuer, storing hashes in TranscriptStorage.  
- Optionally revoke or update via controlled functions.

**For Employers**  
- Register and browse verified users.  
- Send a sharing request via RequestManager.  
- Once approved, use VerificationEngine to confirm details without full access.  
- Get instant proof of authenticity for faster hiring decisions.

That's it! A seamless, blockchain-powered system that puts privacy and security first while streamlining job applications. Deploy on Stacks for low-cost, Bitcoin-secured transactions.