// Content for the home page, taken from the CV. Kept out of the component so
// the copy can be edited without touching layout code.

export const PROFILE = {
  name: "Anik Saha",
  role: "Junior Software Engineer",
  company: { name: "Orbit Informatics", url: "https://www.orbitinformatics.com/" },
  since: "Feb 2025",
  location: "Dhaka, Bangladesh",
  email: "aniksaha.cse.pust@gmail.com",
  github: "https://github.com/Deadly-Smile",
  linkedin: "https://www.linkedin.com/in/anik-saha-cse-pust/",
  summary:
    "I build backend systems, cloud services and automation that take repetitive work off people's desks: event-driven workflows, AI document extraction, serverless pipelines on AWS, and the integrations that tie them to the tools a business already runs on.",
};

// Phrases cycled in the hero, completing "I build …".
export const DOING = [
  "workflow automation platforms",
  "RAG systems over PDFs",
  "serverless pipelines on AWS",
  "biometric entry systems",
  "integrations between ERPs, CRMs & POS",
  "multiplayer games over WebRTC",
];

// Each system is drawn as a left-to-right pipeline of `flow` nodes.
export const WORK = [
  {
    id: "workflow",
    title: "Workflow Automation Platform",
    kind: "Multi-tenant SaaS",
    blurb:
      "A platform where each tenant defines its own database schema and wires JavaScript workflows to events: a record changes, an API is hit, or an email lands. AI pulls structured data out of documents and PDFs, and a Chrome extension autofills and syncs with ERP, CRM and POS systems. Used across sales, marketing and accounting.",
    flow: [
      { label: "Trigger", sub: "email · webhook · record change" },
      { label: "Extract", sub: "AI reads docs & PDFs" },
      { label: "Workflow", sub: "tenant-defined JS" },
      { label: "Integrate", sub: "ERP · CRM · POS · extension" },
    ],
    tech: ["PHP", "JavaScript", "Anthropic API", "Webhooks", "Chrome Extension"],
  },
  {
    id: "rag",
    title: "RAG System",
    kind: "Document Q&A",
    blurb:
      "Retrieval-augmented generation for asking questions of a PDF library, with document management and role-based access control so people only get answers from the documents they're allowed to see.",
    flow: [
      { label: "Ingest", sub: "PDF upload" },
      { label: "Embed", sub: "chunk + vectorise" },
      { label: "Retrieve", sub: "vector DB · RBAC filter" },
      { label: "Answer", sub: "DeepSeek / Anthropic" },
    ],
    tech: ["PHP", "JavaScript", "Python", "DeepSeek API", "Anthropic API", "Vector DB"],
  },
  {
    id: "biometric",
    title: "Biometric Entry System",
    kind: "Identity verification",
    blurb:
      "Fingerprint and face-recognition entry management on desktop, web and a Flutter mobile app. It verifies employees, flags banned ones, tracks employment history, and logs activity behind multi-tier role-based access. I also migrated the data over from the existing databases.",
    flow: [
      { label: "Capture", sub: "fingerprint · face" },
      { label: "Match", sub: "ZKTeco SDK · OpenCV" },
      { label: "Verify", sub: "employee · ban list" },
      { label: "Log", sub: "history · audit trail" },
    ],
    tech: ["PHP", "JavaScript", "C#", "Flutter", "ZKTeco SDK", "OpenCV"],
  },
  {
    id: "sedna-email",
    title: "Sedna Email Scheduler",
    kind: "Serverless · AWS",
    blurb:
      "Schedules email from reusable templates with dynamic content. A chatbot handles automated replies and user interactions, and a caching layer cuts data-retrieval time. The infrastructure is written in Terraform and tested locally with LocalStack.",
    flow: [
      { label: "Schedule", sub: "EventBridge" },
      { label: "Queue", sub: "SQS" },
      { label: "Render", sub: "templates · S3 · SSM" },
      { label: "Reply", sub: "chatbot · DynamoDB" },
    ],
    tech: ["Python", "SQS", "SSM", "S3", "EventBridge", "DynamoDB", "Terraform", "LocalStack"],
  },
  {
    id: "jira",
    title: "Jira Automation",
    kind: "Real-time sync",
    blurb:
      "Keeps issues in sync across Linear, Trello and Jira in real time, so each team can stay in its own tool.",
    flow: [
      { label: "Source", sub: "Linear · Trello" },
      { label: "Ingest", sub: "API Gateway" },
      { label: "Transform", sub: "AWS Lambda" },
      { label: "Sync", sub: "Jira" },
    ],
    tech: ["Python", "AWS Lambda", "API Gateway", "Terraform", "Docker", "LocalStack"],
  },
  {
    id: "aquila",
    title: "Aquila Maintenance",
    kind: "Legacy web app",
    blurb:
      "Kept a long-running production app healthy: shipped new features, fixed bugs and supported day-to-day operations on a Yii backend with a React/Redux frontend.",
    flow: [
      { label: "UI", sub: "React · Redux" },
      { label: "API", sub: "Yii · PHP" },
      { label: "Data", sub: "MySQL" },
      { label: "Ship", sub: "Docker" },
    ],
    tech: ["Yii", "React", "Redux", "PHP", "JavaScript", "MySQL", "Docker"],
  },
  {
    id: "sedna-ext",
    title: "Sedna Chrome Extension",
    kind: "Browser extension",
    blurb:
      "Modifies page content in real time, highlighting chosen elements so readers can focus and dimming the distractions around them.",
    flow: [
      { label: "Page", sub: "live DOM" },
      { label: "Detect", sub: "content script" },
      { label: "Highlight", sub: "React overlay" },
      { label: "Focus", sub: "distractions dimmed" },
    ],
    tech: ["React", "JavaScript"],
  },
];

// Built for this site: links straight into the tool / game.
export const LAB = [
  { to: "/games/fps", icon: "🔫", title: "FPS", desc: "3D shooter in WebGL with bots, team deathmatch and online play" },
  { to: "/toolz/chat", icon: "💬", title: "P2P Chat", desc: "Device-to-device WebRTC chat with key-pinned identities" },
  { to: "/toolz/music_player", icon: "🎵", title: "Music Player", desc: "Local library with cross-device sync" },
  { to: "/games/poker", icon: "♠️", title: "Poker", desc: "Host-authoritative Texas Hold'em for 2–6 players" },
  { to: "/toolz/code", icon: "▶️", title: "Code Runner", desc: "Sandboxed in-browser script runner" },
  { to: "/toolz/question_bank", icon: "📚", title: "Question Bank", desc: "Incremental Supabase sync, exams and stats" },
];

export const SIDE_PROJECTS = [
  {
    title: "SQL Practice Tool",
    desc: "Browser SQL playground on SQLite with 50+ graded challenges.",
    tech: ["React", "TypeScript", "SQLite"],
    href: "https://github.com/Deadly-Smile/SQL_Practice",
  },
  {
    title: "Eco-Sync",
    desc: "Municipal waste-management system. Led the backend and the web + mobile architecture.",
    tech: ["Laravel", "Flask", "React", "Flutter", "Docker"],
  },
  {
    title: "E-Shikkhok",
    desc: "E-learning platform. Led the backend: secure REST APIs, RBAC, progress tracking, built test-first.",
    tech: ["Laravel", "PHPUnit", "MySQL"],
  },
];

export const STACK = [
  { group: "Languages", items: ["Python", "PHP", "JavaScript", "SQL"] },
  { group: "Front-end", items: ["React", "Redux"] },
  { group: "Back-end", items: ["Laravel", "Yii2"] },
  { group: "Databases", items: ["PostgreSQL", "MySQL", "SQLite", "DynamoDB"] },
  { group: "Cloud", items: ["IAM", "SSM", "SQS", "S3", "Lambda", "EventBridge", "API Gateway"] },
  { group: "DevOps", items: ["Docker", "Terraform", "Ansible", "LocalStack", "Git"] },
  { group: "AI / ML", items: ["RAG", "Anthropic API", "DeepSeek API", "OpenAI API", "PaddleOCR"] },
];

export const SOLVING = [
  { site: "Codeforces", value: "1382", note: "max rating", href: "https://codeforces.com/profile/Deadly_Smile" },
  { site: "CodeChef", value: "1528", note: "max rating" },
  { site: "LeetCode", value: "216", note: "problems solved", href: "https://leetcode.com/Serious_Noob/" },
];

export const ACHIEVEMENTS = [
  { year: "2025", text: "B.Sc. in CSE, Pabna University of Science & Technology" },
  { year: "2024", text: "Finalist, CodeSamurai Hackathon" },
  { year: "2023", text: "Champion, Solver Green Intra-University Programming Contest" },
];
