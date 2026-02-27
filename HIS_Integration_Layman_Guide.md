```mermaid
graph TD
    %% Styling
    classDef hospital fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000;
    classDef ours fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000;
    classDef user fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000;
    classDef admin fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px,color:#000;

    subgraph HIS_System ["1. Hospital Admission"]
        Desk("👨‍⚕️ Admin Desk\n(Types Admission)"):::hospital
        HIS[("🏥 Hospital System (HIS)")]:::hospital
    end

    subgraph Integration ["2. The Link"]
        Bridge{"🔌 Integration Bridge"}:::ours
        Ours("🖥️ Backend"):::ours
    end

    subgraph Admin_Actions ["Admin Controls"]
        Admin("👨‍💼 Hospital Admin\n(Overseer Dashboard)"):::admin
        Limit("➕ Increase Visitor Limit\n(Override Default)"):::admin
    end

    subgraph Patient_Action ["3. Patient/Relative Action"]
        WA("💬 WhatsApp Message\n(with link)"):::user
        Form("📱 Visitor Portal\n(Relative enters details)"):::user
        QR("🎟️ Digital Pass\n(QR Code Generated)"):::user
    end

    subgraph Security ["4. Security Verification"]
        Guard("🛡️ Security Guard\n(Scans QR Code)"):::ours
        Verify{"✅ Verification System"}:::ours
        Access("🔓 Access Granted"):::user
    end

    subgraph Discharge ["5. Departure"]
        D_Desk("👨‍⚕️ Admin Desk\n(Marks Discharge)"):::hospital
        Revoke("🚫 Pass Auto-Canceled"):::ours
    end

    %% Connections
    Desk --> HIS
    HIS -.-> Bridge
    Bridge -.-> Ours
    Ours -- "Sends Auto-Msg" --> WA
    WA --> Form
    Form --> QR
    QR -- "Shows to Guard" --> Guard
    Guard --> Verify
    Verify --> Access

    %% Admin Override
    Admin --> Limit
    Limit -- "Update Patient Rule" --> Ours
    Ours -.->|Allows More Passes| Form

    %% Discharge Flow
    HIS -.->|Discharge Event| Bridge
    Bridge -.-> Ours
    Ours --> Revoke
    Revoke -.->|Instant Block| Access
```

### Explaining the End-to-End Flow (Layman's Guide)

**Step 1: Patient Admission**  
Hospital staff admits a patient in their existing system (HIS). They don't need to change their workflow.

**Step 2: The Invisible Bridge**  
Our system automatically detects the new admission and grabs the details (Name, Phone Number, Room).

**Step 3: WhatsApp & Pre-Registration**  
The patient instantly receives a WhatsApp message with a "Visitor Link." They (or a relative) click it to enter visitor details (Name, ID, etc.) from their own phone. Once done, a **Digital QR Pass** is generated on their screen.

**💡 Admin Override (New!)**  
By default, the system might allow only 2 visitors. However, a **Hospital Admin** can log into the Dashboard at any time to increase the visitor count for a specific patient. If they increase the limit to 4, the visitor link will automatically allow 2 more relatives to register.

**Step 4: Secure Entry (QR Verification)**  
When a relative reaches the hospital, they show the QR pass. The Security Guard scans it with our app. The system confirms the patient is still admitted and grants access.

**Step 5: Auto-Cancellation on Discharge**  
The moment the staff marks the patient as "Discharged" in the HIS, our system automatically cancels all active visitor passes for that patient. Security will see "Access Denied" if anyone tries to use those old passes.
