# Production Onboarding & Clinical Launch Manual

This document provides the operational, clinical, and infrastructure playbook for the **Eunice Health Delivery System** to onboard real-world patients and healthcare providers.

---

## 1. Regulatory, Legal & Clinical Compliance

### A. Medical Disclaimer & AI Decision Support Protocols
- **Classification**: Eunice AI functions as **Clinical Decision Support (CDS)** and patient triage guidance.
- **Triage Protocols**:
  - High and Critical risk evaluations automatically prompt urgent doctor video consultations and trigger emergency contact advisories.
  - All advice explicitly clarifies that botanical remedies and machine learning evaluations are supportive and require validation by a licensed medical practitioner.
- **Audit Trails**: Patient acceptances of the 3-point digital consent agreement are stored with ISO-8601 timestamps in encrypted user records (`eunice_clinical_consent`).

### B. Patient Data Privacy (NDPR, GDPR & HIPAA)
- **Data in Transit**: Enforce HTTPS / TLS 1.3 across all client-server interactions.
- **Data at Rest**: Biometric logs, simulated biosensors, and telehealth notes stored in Firestore and MongoDB are protected via authenticated security rules and AES-256 field encryption.
- **Patient Rights**: Built-in user profile management enables export to Google Sheets and one-click record purging.

---

## 2. Production Infrastructure & External Integrations

### A. Live Production Hosting & Custom Domains
1. **Host Options**: Vercel, Google Cloud Run, AWS ECS, or DigitalOcean App Platform.
2. **Build Settings**:
   - Build Command: `npm run build`
   - Start Command: `npm run start` (starts `node dist/server.cjs`)
   - Port: `3000` (or `PORT` environment variable)
3. **Custom Domain**: Attach `app.eunicehealth.com` with automatic SSL provisioning.

### B. WebRTC Video & Audio Infrastructure
- **Signaling**: Integrated WebRTC room management.
- **NAT / Firewall Traversal**: Pre-configured with Google STUN relays (`stun:stun.l.google.com:19302`) and compatible with TURN relays (e.g., LiveKit Cloud, Twilio STUN/TURN, Daily.co, or self-hosted coturn).

### C. Live Payment Gateways
- **Environment Variable**: `PAYSTACK_SECRET_KEY=sk_live_...`
- **Supported Payment Methods**:
  1. Direct card processing via Paystack inline checkout.
  2. NGN Bank Transfer with instant automated account number generation.
  3. Commission settlement tracking for clinician and lab partner revenue sharing.

### D. Physical Dispatch & Pathology Lab Logistics
- **Courier & Fleet Webhook**: `POST /api/dispatch/webhook` allows external dispatch riders (e.g. Kwik, GIG, Max.ng) or diagnostic labs (e.g. Synlab, Clina-Lancet) to stream live pickup coordinates and specimen analysis results back to the patient.

---

## 3. Environment Variables Summary

```env
GEMINI_API_KEY="AIzaSy..."
PAYSTACK_SECRET_KEY="sk_live_..."
DATABASE_URL="mongodb+srv://..."
NODE_ENV="production"
```
