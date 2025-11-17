# 🚀 START HERE - Social Media Agent Contributor's Guide

Welcome to the Social Media Agent! This guide will help you understand the codebase and get started contributing.

## 📚 Table of Contents

1. [What is this project?](#what-is-this-project)
2. [Quick Start](#quick-start)
3. [Project Structure](#project-structure)
4. [Key Concepts](#key-concepts)
5. [Your First Contribution](#your-first-contribution)
6. [Additional Resources](#additional-resources)

---

## What is this project?

The **Social Media Agent** is an AI-powered system that automates social media content creation and posting. Here's what it does:

- **Takes a URL** (blog post, GitHub repo, YouTube video, etc.)
- **Extracts and analyzes** the content using AI
- **Generates optimized posts** for Twitter and LinkedIn
- **Allows human review** before posting (human-in-the-loop)
- **Schedules and publishes** posts automatically

### Real-World Use Case

At LangChain, this agent:
1. Team members share URLs in a Slack channel
2. The agent generates social media posts overnight
3. In the morning, team reviews and approves posts via Agent Inbox
4. Posts are automatically scheduled and published

---

## Quick Start

### Prerequisites

Before you begin, you'll need:
- **Node.js 20+** and **Yarn** package manager
- **Python 3.11+** (for Python components)
- **API Keys** (see below)

### Minimum Setup (Basic Mode)

For just exploring and testing, you need these 4 API keys:

1. **[Anthropic API](https://console.anthropic.com/)** - Powers the AI (Claude)
2. **[LangSmith](https://smith.langchain.com/)** - Tracing and monitoring (free)
3. **[FireCrawl](https://www.firecrawl.dev/)** - Web scraping (500 free credits)
4. **[Arcade](https://www.arcade.dev)** - Social media authentication

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/langchain-ai/social-media-agent.git
cd social-media-agent

# 2. Install dependencies
yarn install

# 3. Set up environment variables
cp .env.quickstart.example .env
# Edit .env and add your API keys

# 4. Install LangGraph CLI
pip install langgraph-cli

# 5. Start the development server
yarn langgraph:in_mem:up

# 6. In a new terminal, run a test
yarn generate_post
```

**That's it!** You've just generated your first post. 🎉

---

## Project Structure

The codebase follows a modular architecture. Here's what each directory does:

```
social-media-agent-langgraph/
├── src/
│   ├── agents/              # 🤖 LangGraph agent workflows
│   │   ├── generate-post/   # Main workflow (URL → Post)
│   │   ├── ingest-data/     # Slack message ingestion
│   │   ├── curate-data/     # Multi-source content aggregation
│   │   ├── generate-thread/ # Twitter thread generation
│   │   ├── repurposer/      # Content repurposing
│   │   ├── supervisor/      # Multi-agent orchestrator
│   │   └── shared/          # Reusable components
│   │
│   ├── clients/             # 🌐 External service integrations
│   │   ├── twitter/         # Twitter API
│   │   ├── linkedin.ts      # LinkedIn OAuth
│   │   ├── reddit/          # Reddit API
│   │   └── slack/           # Slack messaging
│   │
│   ├── utils/               # 🔧 Helper functions
│   │   ├── date.ts          # Date/timezone handling
│   │   ├── firecrawl.ts     # Web scraping
│   │   └── supabase.ts      # Image storage
│   │
│   ├── tests/               # ✅ Integration tests
│   └── evals/               # 📊 Evaluation/validation
│
├── scripts/                 # 📜 CLI utilities
│   ├── generate-post.ts     # Demo script
│   ├── crons/               # Scheduled job management
│   └── backfill.ts          # Bulk processing
│
├── slack-messaging/         # 🐍 Python: Slack bot integration
├── memory-v2/               # 🧠 Python: LLM memory system
│
├── langgraph.json           # ⚙️ Graph deployment config
├── package.json             # Node.js dependencies
└── tsconfig.json            # TypeScript configuration
```

### Where to Start Exploring

**New to the codebase?** Start here:

1. **`src/agents/generate-post/generate-post-graph.ts`** - The main workflow
2. **`scripts/generate-post.ts`** - See how to invoke the graph
3. **`src/agents/generate-post/prompts/`** - Customize AI behavior
4. **`README.md`** - Detailed setup instructions

---

## Key Concepts

### 1. LangGraph Architecture

This project uses **LangGraph**, a framework for building multi-agent AI systems. Think of it as a state machine where:

- **Nodes** are functions that process data
- **Edges** connect nodes and define the flow
- **State** carries data through the workflow
- **Interrupts** pause execution for human input

**Example Flow:**

```
URL Input → Extract Content → Verify Relevance → Generate Post
→ Find Images → [HUMAN REVIEW] → Schedule Post → END
```

### 2. Human-in-the-Loop (HITL)

The workflow **pauses** at `humanNode` and waits for you to:
- ✅ Approve the post
- ✏️ Edit the post
- 🖼️ Change the image
- 📅 Adjust the schedule
- ❌ Reject and regenerate

This is powered by **LangGraph interrupts** and viewed through the **Agent Inbox** UI.

### 3. Multi-Graph System

The project has **14 separate graphs** (think of them as microservices):

| Graph | Purpose |
|-------|---------|
| `generate_post` | Main workflow: URL → Post |
| `ingest_data` | Fetch URLs from Slack |
| `curate_data` | Aggregate content from Twitter/GitHub/Reddit |
| `generate_thread` | Create Twitter threads |
| `supervisor` | Orchestrate multiple agents |
| `repurposer` | Repurpose existing content |
| *...and 8 more* | Specialized workflows |

Each graph is defined in `langgraph.json` and can be invoked independently.

### 4. State Management

Each graph has a **typed state** that flows through the workflow:

```typescript
// Example: GeneratePostState
{
  links: string[],              // Input URLs
  pageContents: string[],       // Extracted content
  report: string,               // Marketing analysis
  post: string,                 // Generated post
  image: {imageUrl, mimeType},  // Selected image
  scheduleDate: Date,           // When to publish
  userResponse: string          // Human feedback
}
```

### 5. Social Media Integration

**Two authentication methods:**

1. **Arcade** (recommended) - One API key for everything
2. **Direct APIs** - Individual Twitter/LinkedIn developer accounts

Posts are scheduled via:
- **Twitter API v2** - Text + media uploads
- **LinkedIn OAuth** - Personal or organization posts

---

## Your First Contribution

Ready to contribute? Here are beginner-friendly tasks:

### 🟢 Easy Tasks

1. **Customize prompts** for your use case
   - Edit `src/agents/generate-post/prompts/index.ts`
   - Change `BUSINESS_CONTEXT` and `TWEET_EXAMPLES`
   - Test with `yarn generate_post`

2. **Add new tweet examples**
   - Edit `src/agents/generate-post/prompts/examples.ts`
   - Add 3-5 examples of posts you like
   - See immediate improvement in post quality

3. **Fix typos in documentation**
   - Check `README.md`, `FEATURES.md`, etc.
   - Submit a PR

### 🟡 Intermediate Tasks

1. **Add support for a new URL type**
   - Example: Product Hunt, Medium, Substack
   - Create a new verifier in `src/agents/shared/nodes/`
   - Add routing logic in `src/agents/verify-links/`

2. **Improve image selection logic**
   - Enhance `src/agents/find-images/`
   - Better ranking algorithm
   - Support more image formats

3. **Add tests**
   - Write integration tests for new features
   - Improve test coverage in `src/tests/`

### 🔴 Advanced Tasks

1. **Add a new social media platform**
   - Example: Bluesky, Mastodon, Threads
   - Implement OAuth in `src/clients/`
   - Update `schedulePost` logic

2. **Implement content caching**
   - Reduce API calls by caching extracted content
   - Use LangGraph Store or external DB

3. **Build analytics dashboard**
   - Track post performance
   - A/B test different prompts

**See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed feature status and suggestions.**

---

## Additional Resources

### Documentation

- **[README.md](./README.md)** - Full setup guide (basic & advanced)
- **[SYSTEM_OVERVIEW.md](./SYSTEM_OVERVIEW.md)** - Deep technical architecture
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Feature status and contribution ideas
- **[FEATURES.md](./FEATURES.md)** - Detailed feature documentation
- **[scripts/README.md](./scripts/README.md)** - CLI utilities guide

### External Docs

- **[LangGraph Documentation](https://langchain-ai.github.io/langgraph/)** - Core framework
- **[LangSmith](https://smith.langchain.com/)** - Debugging and tracing
- **[Agent Inbox](https://github.com/langchain-ai/agent-inbox)** - HITL UI

### Video Tutorial

🎥 **[Setup Video Tutorial](https://youtu.be/TmTl5FMgkCQ)** - Step-by-step walkthrough

### Getting Help

- **GitHub Issues** - Report bugs or ask questions
- **LangChain Discord** - Community support
- **Code Comments** - Many files have detailed inline documentation

---

## Understanding the Codebase Health

### ✅ What's Working

- Core post generation workflow
- Twitter and LinkedIn posting
- Image discovery and validation
- Human-in-the-loop approval
- Slack integration for ingesting URLs
- YouTube, GitHub, Twitter, Reddit content extraction
- Scheduled posting with priority levels
- URL deduplication

### ⚠️ Known TODOs

Based on code analysis, here are areas needing attention:

1. **Schedule dates for repurposed posts** - R1/R2/R3 priority levels undefined
   - `src/agents/repurposer-post-interrupt/nodes/human-node/utils.ts:143-145`

2. **Incomplete evaluations** - Several eval modules have placeholder logic
   - `src/evals/youtube/index.ts:24`
   - `src/evals/general/index.ts:24`
   - `src/evals/twitter/index.ts:24`

3. **Deprecated utilities** - Old reflection utilities should be replaced
   - `src/utils/reflections.ts:50,69`

4. **Error handling** - Some YouTube operations need better error handling
   - `src/agents/shared/nodes/youtube.utils.ts:87`

5. **Memory system** - `memory-v2/` directory is minimal (Python)

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the complete list.

---

## Next Steps

1. ✅ **Run the quick start** to see it in action
2. 📖 **Read [SYSTEM_OVERVIEW.md](./SYSTEM_OVERVIEW.md)** for deep technical understanding
3. 🎯 **Pick a task** from [Your First Contribution](#your-first-contribution)
4. 💬 **Join the community** and introduce yourself
5. 🚀 **Submit your first PR!**

---

**Welcome aboard! We're excited to see what you'll build. 🎉**

*Last updated: {{ current_date }}*
