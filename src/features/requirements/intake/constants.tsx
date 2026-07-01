// Visual + demo constants for the Requirement Intake feature.
import {
  Target,
  Shield,
  Users,
  Lock,
  HelpCircle,
  Link,
  BookOpen,
  ClipboardList,
  Layers,
  CircleDot,
} from "lucide-react";

export const TYPE_COLORS: Record<
  string,
  { border: string; bg: string; text: string; icon: any }
> = {
  functional: {
    border: "border-l-primary",
    bg: "bg-primary/5",
    text: "text-primary",
    icon: Target,
  },
  non_functional: {
    border: "border-l-emerald-500",
    bg: "bg-emerald-500/5",
    text: "text-emerald-600 dark:text-emerald-400",
    icon: Shield,
  },
  user_story: {
    border: "border-l-violet-500",
    bg: "bg-violet-500/5",
    text: "text-violet-600 dark:text-violet-400",
    icon: Users,
  },
  constraint: {
    border: "border-l-slate-400",
    bg: "bg-slate-400/5",
    text: "text-slate-500",
    icon: Lock,
  },
  assumption: {
    border: "border-l-amber-500",
    bg: "bg-amber-500/5",
    text: "text-amber-600 dark:text-amber-400",
    icon: HelpCircle,
  },
  dependency: {
    border: "border-l-cyan-500",
    bg: "bg-cyan-500/5",
    text: "text-cyan-600 dark:text-cyan-400",
    icon: Link,
  },
};

export const PRIORITY_STYLES: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30 font-semibold",
  high: "bg-warning/15 text-warning border-warning/30",
  medium: "bg-primary/10 text-primary border-primary/20",
  low: "bg-muted text-muted-foreground border-border",
};

export const EXAMPLE_REQUIREMENTS: {
  label: string;
  icon: any;
  color: string;
  text: string;
}[] = [
  {
    label: "E-Commerce Platform",
    icon: Target,
    color: "from-primary/10 to-primary/5 border-primary/20 hover:border-primary/40",
    text: `We are building a multi-vendor e-commerce marketplace. The system must support:\n\n1. User registration and authentication (email, Google, Apple Sign-In)\n2. Product catalog with categories, filters, search, and recommendations\n3. Shopping cart with persistent state across sessions\n4. Checkout with Stripe and PayPal payment processing\n5. Order management with real-time tracking and delivery notifications\n6. Seller dashboard for inventory, pricing, and order fulfillment\n7. Customer reviews and ratings system\n8. Admin panel for user management, dispute resolution, and analytics\n\nNon-functional requirements:\n- Handle 50,000 concurrent users with <200ms API response time\n- 99.95% uptime SLA\n- PCI-DSS compliance for payment data\n- GDPR compliance for EU users\n- Mobile-responsive web app + native iOS/Android apps\n\nConstraints:\n- Must integrate with existing warehouse management system (SAP)\n- Launch within 6 months with a team of 8 developers\n- Budget capped at $500K for MVP`,
  },
  {
    label: "Healthcare Portal",
    icon: Shield,
    color: "from-rose-500/10 to-rose-500/5 border-rose-500/20 hover:border-rose-500/40",
    text: `Design a HIPAA-compliant patient portal for a hospital network. Key features:\n\n1. Patient self-registration with identity verification (SSN + DOB)\n2. Appointment scheduling with doctor availability calendar\n3. Secure access to medical records, lab results, and imaging\n4. Telemedicine: video consultations with screen sharing\n5. Prescription management and pharmacy integration\n6. Secure messaging between patients and care teams\n7. Insurance verification and billing dashboard\n8. Emergency contact and allergy/medication alerts\n\nNon-functional:\n- HIPAA, HITECH, and SOC 2 Type II compliance\n- Integration with Epic EHR via HL7 FHIR R4\n- Support 10,000 concurrent users\n- Data encryption at rest (AES-256) and in transit (TLS 1.3)\n- 99.99% uptime for critical services\n- Audit logging for all PHI access\n\nAssumptions:\n- Hospital already has Epic EHR deployed\n- Patients have smartphones or desktop access`,
  },
  {
    label: "IoT Fleet Management",
    icon: Link,
    color: "from-amber-500/10 to-amber-500/5 border-amber-500/20 hover:border-amber-500/40",
    text: `Build a real-time fleet management and logistics platform:\n\n1. GPS tracking for 5,000+ vehicles with 5-second position updates\n2. Route optimization engine using traffic data and delivery windows\n3. Driver mobile app with turn-by-turn navigation and task queue\n4. Geofencing with automated alerts for zone entry/exit\n5. Fuel consumption analytics and anomaly detection\n6. Vehicle maintenance scheduling with predictive alerts (OBD-II data)\n7. Customer delivery notification system with ETA tracking\n8. Dispatch dashboard with drag-and-drop route assignment\n9. Reporting: fuel costs, driver performance, delivery SLAs\n\nNon-functional:\n- Process 50,000 GPS events per second\n- Sub-100ms latency for real-time map updates\n- Offline-capable driver app (sync when connected)\n- Integration with Samsara and Geotab telematics\n- Multi-tenant architecture for fleet management companies\n\nConstraints:\n- Must run on AWS with multi-region deployment\n- Budget: $350K for Phase 1`,
  },
  {
    label: "Fintech Banking App",
    icon: Lock,
    color: "from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40",
    text: `We need a digital banking application for a neobank:\n\n1. Account opening with eKYC (ID scan + selfie verification)\n2. Current and savings accounts with instant virtual card issuance\n3. P2P transfers, SEPA payments, and international wire transfers\n4. Bill payments and standing orders\n5. Investment portfolio with mutual funds and ETFs\n6. Spending analytics with category breakdown and budgets\n7. Push notifications for transactions, low balance, and fraud alerts\n8. Customer support chat with AI-powered first response\n9. Admin console with compliance reporting and AML monitoring\n\nNon-functional:\n- PCI-DSS Level 1 and PSD2 SCA compliance\n- 99.99% uptime with zero data loss (RPO = 0)\n- Transaction processing < 2 seconds end-to-end\n- Support 500K registered users, 50K DAU\n- Multi-currency support (EUR, USD, GBP)\n\nIntegrations:\n- Core banking: Mambu\n- Card issuing: Marqeta\n- KYC: Onfido\n- Payments: SWIFT, SEPA Instant`,
  },
  {
    label: "Learning Management",
    icon: BookOpen,
    color: "from-violet-500/10 to-violet-500/5 border-violet-500/20 hover:border-violet-500/40",
    text: `Build an online education platform for universities and corporate training:\n\n1. Course creation with rich-text editor, video uploads, and file attachments\n2. Adaptive video streaming with multi-resolution playback (HLS)\n3. Quiz and assessment engine with auto-grading (MCQ, coding, essays via AI)\n4. Student progress tracking with completion certificates (PDF generation)\n5. Discussion forums with threaded replies, @mentions, and moderation\n6. Live virtual classrooms with video conferencing, whiteboard, and breakout rooms\n7. Gradebook with weighted rubrics and grade export (CSV/LTI)\n8. Role-based access: Admin, Instructor, TA, Student, Auditor\n9. Mobile app with offline video download and push notifications\n\nNon-functional:\n- SCORM 2004 and xAPI (Tin Can) compliance for content interoperability\n- Support 10,000 concurrent learners streaming video simultaneously\n- 99.9% uptime with CDN-backed content delivery\n- FERPA and GDPR compliance for student data\n- Accessibility: WCAG 2.1 AA compliant\n\nIntegrations:\n- SSO via SAML 2.0 and OAuth 2.0\n- LTI 1.3 for third-party tool integration\n- Zoom/Teams for live sessions\n- Stripe for course payments\n\nConstraints:\n- Must support multi-tenant white-labeling for enterprise clients\n- Initial launch with 500 courses and 50K registered users`,
  },
  {
    label: "SaaS Project Mgmt",
    icon: ClipboardList,
    color: "from-cyan-500/10 to-cyan-500/5 border-cyan-500/20 hover:border-cyan-500/40",
    text: `Design a multi-tenant project management SaaS tool for distributed teams:\n\n1. Workspace creation with team invitations and role management (Owner, Admin, Member, Guest)\n2. Kanban boards with drag-and-drop, custom columns, WIP limits, and swimlanes\n3. Gantt chart view with dependency linking, critical path, and milestone tracking\n4. Time tracking with timer, manual entry, and timesheet approval workflows\n5. Resource allocation with capacity planning and workload heatmaps\n6. Sprint planning with backlog grooming, velocity charts, and burndown reports\n7. Document wiki with version history, templates, and embedded diagrams\n8. Custom dashboards with drag-and-drop widgets, charts, and KPIs\n9. Automation rules: "When status changes to Done, notify channel and update sprint progress"\n10. Activity feed with @mentions, reactions, and threaded comments on any entity\n\nNon-functional:\n- Sub-200ms page load for boards with 500+ cards\n- Real-time collaboration with live cursors and conflict resolution\n- Support 100K workspaces with 1M+ users\n- SOC 2 Type II and ISO 27001 compliance\n- 99.95% uptime SLA with multi-region deployment\n\nIntegrations:\n- Slack, Microsoft Teams, Discord notifications\n- Jira, Asana, Trello import/export\n- GitHub, GitLab, Bitbucket for dev workflow\n- Google Drive, Dropbox for file attachments\n\nConstraints:\n- White-label support for enterprise customers\n- API-first architecture with public REST + GraphQL APIs\n- Budget: $800K for v1.0 with 12-month timeline`,
  },
  {
    label: "Multiplayer Game Backend",
    icon: Layers,
    color: "from-pink-500/10 to-pink-500/5 border-pink-500/20 hover:border-pink-500/40",
    text: `Build a scalable real-time multiplayer game backend for a competitive action game:\n\n1. Player authentication with email, Steam, PlayStation Network, and Xbox Live\n2. Matchmaking system with skill-based rating (Elo/Glicko-2), region preferences, and party queues\n3. Real-time game state synchronization via WebSocket with server-authoritative logic\n4. Leaderboards: global, regional, seasonal, and friends-only rankings\n5. Player profiles with stats, match history, achievements, and cosmetic inventory\n6. In-app purchase store with virtual currency, battle passes, and cosmetic items\n7. Anti-cheat system with server-side validation, anomaly detection, and ban management\n8. Social features: friends list, party system, voice chat, and in-game messaging\n9. Tournament system with brackets, scheduled matches, and prize distribution\n10. Analytics pipeline: player retention, monetization funnels, session heatmaps\n\nNon-functional:\n- Handle 100,000 concurrent connections with <50ms tick rate\n- Auto-scaling game servers across 6 global regions (NA, EU, APAC, SA, ME, OCE)\n- 99.9% uptime for matchmaking and auth services\n- Data replication across regions with eventual consistency for profiles\n- DDoS protection and rate limiting on all public endpoints\n\nIntegrations:\n- Steam, Epic Games Store, PlayStation, Xbox platform APIs\n- Payment: Stripe, Steam Wallet, platform-native IAP\n- Analytics: custom pipeline to BigQuery\n- Voice: Vivox or Agora SDK\n\nConstraints:\n- Must support cross-play between PC and consoles\n- Game server instances on Kubernetes with spot/preemptible nodes\n- Budget: $600K for backend MVP, 9-month delivery`,
  },
  {
    label: "Smart Agriculture IoT",
    icon: CircleDot,
    color: "from-green-600/10 to-green-600/5 border-green-600/20 hover:border-green-600/40",
    text: `Design an IoT platform for precision agriculture and smart farming:\n\n1. Sensor data ingestion from soil moisture, temperature, humidity, pH, and light sensors (MQTT/CoAP)\n2. Weather station integration with local microclimate forecasting (7-day predictions)\n3. Automated irrigation control with zone-based scheduling and soil-moisture triggers\n4. Crop health monitoring via drone imagery analysis (NDVI, RGB anomaly detection)\n5. Pest and disease early warning system using sensor data + satellite imagery + AI models\n6. Yield prediction engine using historical data, weather patterns, and current crop health\n7. Farm management dashboard with field maps, crop rotation planner, and input tracking (fertilizers, pesticides)\n8. Mobile app for farmers with offline mode, push alerts, and voice commands (multilingual)\n9. Supply chain module: harvest scheduling, quality grading, and buyer marketplace\n10. Equipment fleet tracking with maintenance scheduling and fuel monitoring\n\nNon-functional:\n- Ingest data from 50,000+ edge devices with 30-second reporting intervals\n- Process 1M+ data points per minute with time-series database (TimescaleDB/InfluxDB)\n- Edge computing support for local decision-making when connectivity is poor\n- Offline-first mobile app syncing when back online\n- Data retention: raw data for 2 years, aggregated data for 10 years\n- Support multi-language UI (English, Spanish, Hindi, Portuguese, French)\n\nIntegrations:\n- John Deere Operations Center API\n- DJI FlightHub for drone management\n- Sentinel-2 satellite imagery API\n- Local weather APIs (OpenWeatherMap, IBM Weather)\n- ERP integration for farm accounting (SAP, QuickBooks)\n\nConstraints:\n- Must work on low-bandwidth rural connections (2G/3G fallback)\n- Solar-powered sensor nodes with ultra-low power protocols (LoRaWAN, NB-IoT)\n- Budget: $450K for MVP covering 3 pilot farms\n- Compliance: EU Farm-to-Fork data traceability regulations`,
  },
];
