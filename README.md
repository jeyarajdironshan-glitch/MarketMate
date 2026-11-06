# MarketMate – AgriTech Wholesale Network (Sri Lanka)
> **Tagline:** Connecting Suppliers. Empowering Distributors.  
> **Target Audience:** Vegetable and fruit suppliers (farmers), wholesale market distributors, and platform administrators in Sri Lanka.

MarketMate is a modern, responsive, and accessible web application designed to solve critical communication, transparency, and trust challenges in Sri Lanka's agricultural supply chain.

---

## 🌟 The 4 Main Innovations

### 1. CBSL Smart Price Alert System
- **Official Data Source:** Central Bank of Sri Lanka (CBSL) published Daily Price Reports (`https://www.cbsl.gov.lk/en/statistics/economic-indicators/price-report` and `https://www.cbsl.gov.lk/si/publications/price`).
- **Core Functionality:**
  - Automatically retrieves newly published daily reports for Dambulla and Manning Market (Pettah).
  - Calculates commodity price increases and decreases against previous official CBSL bulletins.
  - Automatically dispatches smart alerts to suppliers (e.g., *"Tomato wholesale price increased by +Rs. 40 (+22.22%) at Dambulla Dedicated Economic Centre"*).
  - Explicit transparency: Displays exact official report dates, last synchronization time, and disclaimers emphasizing official published daily data rather than speculative tickers.
  - Admin inspection panel allowing review and verification of extracted price records before publishing.

### 2. Digital Delivery Settlement Slip
- **Eliminates Misunderstandings:** Provides a transparent digital record for every delivery.
- **Accurate Mathematical Validations:**
  $$\text{Accepted Quantity} = \text{Quantity Received} - \text{Damaged Quantity} - \text{Rejected Quantity}$$
  $$\text{Total Payable Amount} = \text{Accepted Quantity} \times \text{Agreed Price per kg}$$
  - Enforces strict validation preventing negative quantities or invalid damage claims.
- **Mutual Confirmation Workflow:**
  1. Distributor enters arrival weights and deductions.
  2. System auto-calculates accepted quantities and payable total.
  3. Supplier reviews the digital settlement slip on their dashboard.
  4. Both parties mutually confirm the settlement slip.
  5. If the supplier disputes deductions, the slip is held transparently as `Disputed` with an audit reason instead of being silently finalized.

### 3. Supplier and Distributor Reliability History
- **Objective Trust Metrics:** Dynamically calculated from verified platform deliveries, completion rates, dispute counts, and payment timeliness.
- **No Fake Ratings:** Based exclusively on verified platform audit logs.
- Protects financial confidentiality while providing meaningful trust standing to help users make informed partnership decisions.

### 4. Voice-Based Natural Speech Interaction
- **High Accessibility:** Built for users who may have limited digital literacy.
- **Trilingual Speech Interface:** Supports **Sinhala (සිංහල)**, **Tamil (தமிழ்)**, and **English**.
- **Capabilities:**
  - Voice query prices: *"What is today's tomato price?"*, *"අද තක්කාලි මිල කීයද?"*, *"இன்றைய தக்காளி விலை என்ன?"*
  - Inquire payment balances: *"Show my pending payments"*, *"මගේ ගෙවීම් පෙන්වන්න"*, *"எனது நிலுவை கட்டணங்களைக் காட்டு"*
  - Inquire market hours: *"Is Dambulla market open?"*, *"දඹුල්ල වෙළඳපොල විවෘතද?"*, *"தம்புள்ளை சந்தை திறக்கப்பட்டுள்ளதா?"*
  - Audio responses read out loud via Web Speech Synthesis with native pronunciation, accompanied by quick manual command chips for browser environments without microphone access.

---

## 🏛️ Wholesale Markets & Relationship Rules

Supported Wholesale Economic Centres:
1. **Dambulla Dedicated Economic Centre (DDEC)**
2. **Manning Market (Peliyagoda / Colombo)**
3. **Meegoda Dedicated Economic Centre**

### Important Business Rules
- **One Market → Many Distributors**
- **One Distributor → Many Suppliers**
- **Each Supplier has EXACTLY ONE Active Distributor at a time.**
- **Administrator Facilitation:** The admin does *not* arbitrarily force assignments. The supplier chooses a distributor $\rightarrow$ Admin facilitates contact sharing with consent $\rightarrow$ Parties discuss terms $\rightarrow$ Both mutually confirm $\rightarrow$ Admin verifies and activates the partnership.
- **Distributor Migration:** When a supplier submits a change request, their prior active connection is safely terminated only after the new partnership is verified and activated.

---

## 💳 Payment Gateway Integration (PayHere Sandbox)

- Integrated with the **PayHere Sandbox Checkout**:
  - Secure server-side MD5 hash generation:
    $$\text{Hash} = \text{strtoupper}(\text{md5}(\text{merchant\_id} + \text{order\_id} + \text{amount} + \text{currency} + \text{strtoupper}(\text{md5}(\text{merchant\_secret}))))$$
  - IPN webhook (`/api/payments/payhere-notify`) verifying cryptographic signatures.
  - Interactive modal with test card simulation for instant verification and settlement updating.

---

## 👥 Demo User Accounts

| Role | Email | Password | Details |
|---|---|---|---|
| **Supplier (Farmer)** | `kamal@supplier.lk` | `MarketMate@2026` | Kamal Perera (Welimada & Dambulla farm) |
| **Supplier (Upcountry)**| `sunil@supplier.lk` | `MarketMate@2026` | Sunil Shantha (Nuwara Eliya farm) |
| **Supplier (Northern)** | `ravi@supplier.lk` | `MarketMate@2026` | Ravi Kumar (Pending request demo) |
| **Distributor** | `aruna@distributor.lk` | `MarketMate@2026` | Aruna Wholesale Traders (Dambulla, Stall B-42) |
| **Distributor** | `bandara@distributor.lk` | `MarketMate@2026` | Bandara & Sons (Manning Market, Stall P-15) |
| **Administrator** | `admin@marketmate.lk` | `Admin@123` | Central Platform Administrator |

*Note: You can switch between demo roles in 1 click using the top navigation bar role switcher.*

---

## 🚀 Quick Start & Running MarketMate

### Prerequisites
- Node.js (v18+) & npm

### 1. Launch the Application
In your terminal, start the backend server (which also serves the compiled frontend on port 5000):

```powershell
cd C:\Users\USER\.gemini\antigravity\scratch\marketmate\backend
node src/index.js
```

Then open your browser at:
👉 **`http://localhost:5000`**

### 2. Frontend Development Server (Optional Hot-Reloading)
If you wish to edit frontend code with Vite live hot-reload:

```powershell
cd C:\Users\USER\.gemini\antigravity\scratch\marketmate\frontend
npm run dev
```

Visit:
👉 **`http://localhost:3000`** (requests automatically proxy to backend at port 5000)

---

## 🗄️ Database Architecture (MySQL / SQLite)

The platform includes a normalized 16-table database design:
1. `Users`
2. `Markets`
3. `Distributors`
4. `Suppliers`
5. `DistributorRequests`
6. `DistributorConnections`
7. `CBSLPriceReports`
8. `VegetablePrices`
9. `PriceAlerts`
10. `Deliveries`
11. `DeliverySettlementConfirmations`
12. `ProductFeedback`
13. `Payments`
14. `ReliabilityHistory`
15. `MarketAnnouncements`
16. `Notifications`

- **Self-contained SQLite Mode:** Ready out-of-the-box with auto-persistence in `backend/data/marketmate.sqlite`.
- **MySQL Mode:** Ready for direct import into XAMPP / MariaDB / MySQL using `marketmate_complete.sql` or `backend/src/database/schema.sql`.
