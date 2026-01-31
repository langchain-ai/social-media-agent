# 🏗️ System Overview - Social Media Agent Technical Architecture

This document provides comprehensive technical documentation of the Social Media Agent architecture, data flows, and implementation details.

## 📑 Table of Contents

1. [High-Level Architecture](#high-level-architecture)
2. [Technology Stack](#technology-stack)
3. [Core Graphs](#core-graphs)
4. [State Management](#state-management)
5. [Data Flows](#data-flows)
6. [External Integrations](#external-integrations)
7. [Configuration System](#configuration-system)
8. [Testing Architecture](#testing-architecture)
9. [Deployment](#deployment)
10. [Extension Points](#extension-points)

---

## High-Level Architecture

### Design Pattern

The Social Media Agent implements a **multi-graph microservices architecture** using LangGraph:

- **14 independent graphs** that can be invoked separately
- **Stateful workflows** with persistent state across nodes
- **Event-driven communication** between graphs
- **Human-in-the-loop (HITL)** via interrupts
- **Composable subgraphs** for reusable logic

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     LangGraph Platform                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ generate_post│  │ ingest_data  │  │ curate_data  │      │
│  └───────┬──────┘  └──────┬───────┘  └──────┬───────┘      │
│          │                 │                  │              │
│          └─────────────────┴──────────────────┘              │
│                            │                                 │
│                    ┌───────▼────────┐                        │
│                    │  LangGraph     │                        │
│                    │  State Store   │                        │
│                    └───────┬────────┘                        │
└────────────────────────────┼──────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼────┐        ┌─────▼─────┐       ┌─────▼─────┐
   │ Slack   │        │ Twitter/  │       │ Supabase  │
   │         │        │ LinkedIn  │       │ (Images)  │
   └─────────┘        └───────────┘       └───────────┘
```

### Codebase Statistics

- **Total TypeScript Files:** ~150
- **Lines of Code:** ~2,930 (TypeScript)
- **Test Files:** 28
- **Graphs:** 14
- **External Services:** 10+

---

## Technology Stack

### Core Framework

| Technology | Version | Purpose |
|------------|---------|---------|
| **@langchain/langgraph** | 0.3.11 | Agent orchestration framework |
| **@langchain/core** | 0.3.66 | LangChain base abstractions |
| **@langchain/anthropic** | 0.3.24 | Claude AI integration |
| **langsmith** | 0.3.49 | Tracing, debugging, monitoring |
| **TypeScript** | 5.3.3 | Type-safe JavaScript |
| **Node.js** | 20+ | Runtime environment |

### External Services

#### AI & Processing
- **Anthropic Claude** - LLM for content generation
- **Google Vertex AI** - YouTube transcript processing
- **FireCrawl** - Web scraping and content extraction

#### Social Media
- **Twitter API v2** - Tweet reading and posting
- **LinkedIn OAuth 2.0** - LinkedIn posting
- **Reddit API (snoowrap)** - Reddit content extraction
- **Arcade AI** - Unified social media authentication

#### Storage & Messaging
- **Supabase** - Image storage with public URLs
- **Slack API** - Message ingestion and notifications
- **LangGraph Store** - Persistent key-value storage

#### Developer Tools
- **GitHub API (Octokit)** - Repository content extraction
- **YouTube Data API** - Video metadata and transcripts

### Build & Development

| Tool | Purpose |
|------|---------|
| **Yarn** | Package management |
| **Jest + ts-jest** | Testing framework |
| **ESLint** | Code linting |
| **Prettier** | Code formatting |
| **Playwright** | Browser automation (screenshots) |
| **LangGraph CLI** | Development server & deployment |

---

## Core Graphs

The system is composed of 14 LangGraph workflows. Each is independently deployable and invocable.

### 1. `generate_post` - Main Content Generation

**File:** `src/agents/generate-post/generate-post-graph.ts`

**Purpose:** Takes URLs and generates optimized social media posts

**Flow:**
```
START
  → authSocialsPassthrough (authenticate with social platforms)
  → verifyLinksSubGraph (extract and validate content)
  → generateReportOrEndConditionalEdge (check for duplicates)
  → generateContentReport (create marketing analysis)
  → generatePost (LLM generates post)
  → condenseOrHumanConditionalEdge (check length)
  → [condensePost loop if needed]
  → findImagesSubGraph (discover and rank images)
  → routeToCuratedInterruptOrContinue (handle different origins)
  → humanNode [INTERRUPT] (human review)
  → routeResponse (parse user input)
  → [rewritePost / schedulePost / updateScheduleDate]
  → END
```

**Key Nodes:**

| Node | Description | LLM? |
|------|-------------|------|
| `verifyLinksSubGraph` | Subgraph that routes to specialized content extractors | ✓ |
| `generateContentReport` | Analyzes content and creates marketing report | ✓ |
| `generatePost` | Generates initial social media post | ✓ |
| `condensePost` | Shortens post if over character limit | ✓ |
| `findImagesSubGraph` | Subgraph for image discovery and ranking | ✓ |
| `humanNode` | Interrupts for human review (HITL) | ✗ |
| `schedulePost` | Publishes to Twitter/LinkedIn | ✗ |

**State Interface:**
```typescript
{
  links: string[]                    // Input URLs
  relevantLinks: string[]            // URLs deemed relevant
  pageContents: {url, content}[]     // Extracted text
  report: string                     // Marketing report
  post: string                       // Generated post
  complexPost: {main_post, reply}    // Post with split URL
  image: {imageUrl, mimeType}        // Selected image
  scheduleDate: Date                 // Publishing schedule
  userResponse: string               // Human feedback
  next: string                       // Routing decision
  // ... + config flags
}
```

**Configurable Parameters:**
- `textOnlyMode` - Skip image handling
- `skipContentRelevancyCheck` - Bypass content validation
- `skipUsedUrlsCheck` - Allow duplicate URLs
- `postToLinkedInOrganization` - Post as company vs. personal
- `twitterUserId`, `linkedinUserId` - Override default accounts

---

### 2. `verify_links` - Content Extraction Subgraph

**File:** `src/agents/verify-links/verify-links-graph.ts`

**Purpose:** Routes URLs to specialized extractors based on type

**Supported URL Types:**

| Type | Verifier Node | Output |
|------|---------------|--------|
| **General Web** | `verifyGeneralContent` | FireCrawl scraped text |
| **GitHub** | `verifyGitHubContent` | README + repo metadata |
| **YouTube** | `verifyYouTubeContent` | Transcript + AI summary |
| **Twitter** | `verifyTweetContent` | Tweet text + metadata |
| **Reddit** | `verifyRedditContent` | Post + comments |
| **Luma Events** | `verifyLumaContent` | Event details |

**Routing Logic:**
```typescript
function routeLinkTypes(state: VerifyLinksAnnotation) {
  const { link } = state;
  const type = checkLinkType(link);

  if (type === "twitter") return new Send("verifyTweetContent", { link });
  if (type === "youtube") return new Send("verifyYouTubeContent", { link });
  if (type === "github") return new Send("verifyGitHubContent", { link });
  // ... etc
  return new Send("verifyGeneralContent", { link });
}
```

**Parallel Processing:** All URLs are processed concurrently using `Send` API.

---

### 3. `ingest_data` - Slack Message Ingestion

**File:** `src/agents/ingest-data/ingest-data-graph.ts`

**Purpose:** Fetch URLs from Slack and trigger post generation

**Flow:**
```
START
  → ingestSlackData (fetch messages from channel)
  → generatePostFromMessages (invoke generate_post for each URL)
  → END
```

**Configuration:**
- `maxMessages` - Limit number of messages to process
- `hoursAgo` - How far back to fetch (default: 24 hours)
- `slackChannelId` - Override default channel
- `addDelayToScheduledPost` - Stagger post scheduling

**Use Case:** Run as a **cron job** (e.g., daily) to automatically process URLs shared in a Slack channel.

---

### 4. `curate_data` - Multi-Source Content Aggregation

**File:** `src/agents/curate-data/index.ts`

**Purpose:** Aggregate content from Twitter, GitHub, Reddit, and newsletters

**Flow:**
```
START
  → ingestData (fetch from multiple sources in parallel)
  → [verifyGeneralContent, verifyGitHubContent, verifyRedditContent, validateBulkTweets]
  → extractAINewsletterContent (parse newsletter links)
  → groupTweetsByContent (cluster similar tweets)
  → reflectOnTweetGroups (LLM analyzes groups)
  → formatData (prepare for supervisor)
  → END
```

**Data Sources:**
- Twitter timeline (recent tweets)
- GitHub trending repositories
- Reddit subreddits (configurable)
- AI newsletters (external links)

**Output:** Structured data for the `supervisor` graph to generate batched posts.

---

### 5. `supervisor` - Multi-Agent Orchestrator

**File:** `src/agents/supervisor/supervisor-graph.ts`

**Purpose:** Coordinate multiple data sources and generate comprehensive reports

**Flow:**
```
START
  → extractData (parallel: tweets, GitHub, Reddit, newsletter)
  → generateReport (cross-source analysis)
  → determinePostType (decide content type)
  → generatePosts (batch post generation)
  → END
```

**Use Case:** Generate weekly/monthly roundup posts from aggregated content.

---

### 6. `generate_thread` - Twitter Thread Generation

**File:** `src/agents/generate-thread/index.ts`

**Purpose:** Create multi-tweet threads from long-form content

**Flow:**
```
START
  → verifyLinksSubGraph (extract content)
  → generateThreadPlan (outline thread structure)
  → generateThreadPosts (generate each tweet)
  → humanNode [INTERRUPT] (review thread)
  → scheduleThread (publish sequentially)
  → END
```

**Features:**
- Automatic tweet splitting (280 char limit)
- Coherent narrative across tweets
- Human editing of individual tweets
- Sequential posting with delays

---

### 7. `repurposer` - Content Repurposing

**File:** `src/agents/repurposer/index.ts`

**Purpose:** Turn one piece of content into multiple posts (campaign)

**Flow:**
```
START
  → extractContent (from URL or file)
  → validateImage (optional)
  → generateCampaignPlan (multiple post ideas)
  → generatePosts (create variations)
  → [interrupt for each post via repurposer_post_interrupt]
  → END
```

**Use Case:** Generate 5-10 different posts from a single blog article.

---

### 8-14. Supporting Graphs

| Graph | Purpose | File |
|-------|---------|------|
| `upload_post` | Upload pre-written posts | `src/agents/upload-post/` |
| `generate_report` | Standalone report generation | `src/agents/generate-report/` |
| `reflection` | Content reflection/analysis | `src/agents/reflection/` |
| `verify_tweet` | Standalone tweet verification | `src/agents/verify-tweet/` |
| `verify_reddit_post` | Standalone Reddit verification | `src/agents/verify-reddit-post/` |
| `curated_post_interrupt` | HITL for curated posts | `src/agents/curated-post-interrupt/` |
| `repurposer_post_interrupt` | HITL for repurposed posts | `src/agents/repurposer-post-interrupt/` |
| `ingest_repurposed_data` | Batch repurposing from Slack | `src/agents/ingest-repurposed-data/` |

---

## State Management

### LangGraph State Architecture

The project uses **Annotation-based state** (LangGraph 0.3+):

```typescript
import { Annotation } from "@langchain/langgraph";

export const GeneratePostAnnotation = Annotation.Root({
  links: Annotation<string[]>({
    reducer: (_state, update) => update,
    default: () => [],
  }),
  post: Annotation<string>({
    reducer: (_state, update) => update,
    default: () => "",
  }),
  // ... more fields
});

export type GeneratePostState = typeof GeneratePostAnnotation.State;
```

### State Reducers

**How state updates work:**

- `reducer: (_state, update) => update` - Replace completely
- `reducer: (state, update) => [...state, ...update]` - Append to array
- `reducer: (state, update) => ({ ...state, ...update })` - Merge objects

### Persistent Storage

**LangGraph Store** is used for:

1. **Used URLs tracking** (`/post_urls/used` namespace)
   - Prevents duplicate content generation
   - Checked in `generateReportOrEndConditionalEdge`
   - Saved in `schedulePost`

2. **Future use cases:**
   - Content caching
   - User preferences
   - Analytics data

**Example Usage:**
```typescript
import { Store } from "@langchain/langgraph";

const store = new Store();

// Save used URL
await store.put(["post_urls", "used"], url, {
  usedAt: new Date(),
  postId: threadId
});

// Check if URL was used
const item = await store.get(["post_urls", "used"], url);
if (item) {
  console.log("URL already used!");
}
```

### Configurable State

Certain state fields can be overridden at runtime via **configurable parameters**:

```typescript
// In constants.ts
export const TEXT_ONLY_MODE = "textOnlyMode";
export const SKIP_USED_URLS_CHECK = "skipUsedUrlsCheck";

// Usage in nodes
const configurable = state.configurable ?? {};
const textOnlyMode = configurable[TEXT_ONLY_MODE] ?? false;
```

---

## Data Flows

### End-to-End: URL to Published Post

```
[1] User Input
    ↓
    URL: "https://blog.example.com/article"

[2] verifyLinksSubGraph
    ↓
    - Determine type: "general"
    - Route to: verifyGeneralContent
    - FireCrawl scrapes content
    ↓
    pageContents: [{
      url: "https://blog.example.com/article",
      content: "Article text...",
      images: ["https://cdn.example.com/image.png"]
    }]

[3] generateContentReport
    ↓
    - Claude analyzes content
    - Checks relevance to BUSINESS_CONTEXT
    ↓
    report: "This article discusses X, Y, Z. Key takeaways:..."

[4] generatePost
    ↓
    - Claude generates post using:
      * Marketing report
      * TWEET_EXAMPLES (few-shot)
      * POST_STRUCTURE_INSTRUCTIONS
      * POST_CONTENT_RULES
    ↓
    post: "Check out this guide to X...\n\n[URL]"

[5] condensePost (if needed)
    ↓
    - If post > 280 chars (excluding URLs)
    - Claude condenses (max 3 attempts)
    ↓
    post: "Concise version...\n\n[URL]"

[6] findImagesSubGraph
    ↓
    - Extract images from pageContents
    - Filter by MIME type, size, dimensions
    - Claude scores relevance to post
    - Re-rank and select top image
    ↓
    image: {
      imageUrl: "https://supabase.co/storage/v1/...",
      mimeType: "image/png"
    }

[7] humanNode [INTERRUPT]
    ↓
    - Execution pauses
    - User reviews in Agent Inbox
    - User actions:
      * "schedule" → schedulePost
      * "rewrite: Make it more casual" → rewritePost
      * "split url" → rewriteWithSplitUrl
    ↓
    userResponse: "schedule"

[8] schedulePost
    ↓
    - Format post (plain or complex with reply)
    - Upload image to Twitter/LinkedIn
    - Schedule tweet via Arcade or Twitter API
    - Schedule LinkedIn post
    - Save URLs to LangGraph Store
    - Send Slack notification (if configured)
    ↓
    END

[9] Published!
    Twitter: "Check out this guide..."
    LinkedIn: "Check out this guide..."
```

### Parallel Processing

**verifyLinksSubGraph** processes multiple URLs concurrently:

```typescript
// Input: links = ["url1", "url2", "url3"]

// Fan-out: Create parallel tasks
links.map(link => new Send("verifyGeneralContent", { link }))

// Each URL processed independently
// Results aggregated back into pageContents[]

// Fan-in: Continue to next node when all complete
```

### Conditional Routing

**Dynamic edges** based on state:

```typescript
function condenseOrHumanConditionalEdge(state: GeneratePostState): string {
  const { post, condenseCount } = state;
  const textOnlyMode = state.configurable?.[TEXT_ONLY_MODE] ?? false;

  // Check if post is too long (without URLs)
  const postWithoutUrl = post.replace(/https?:\/\/[^\s]+/g, "");
  if (postWithoutUrl.length > 280 && condenseCount <= 3) {
    return "condensePost"; // Loop back
  }

  if (textOnlyMode) {
    return "humanNode"; // Skip images
  }

  return "findImagesSubGraph"; // Continue
}
```

---

## External Integrations

### Twitter Integration

**Files:** `src/clients/twitter/`

**Two modes:**

1. **Arcade (recommended)**
   ```typescript
   import { Arcade } from "@arcadeai/arcadejs";

   const arcade = new Arcade({ apiKey: process.env.ARCADE_API_KEY });

   // Post tweet
   await arcade.tools.execute({
     toolName: "Twitter.PostTweet",
     userId: process.env.TWITTER_USER_ID,
     inputs: {
       text: post,
       mediaIds: [imageId]
     }
   });
   ```

2. **Direct API**
   ```typescript
   import { TwitterApi } from "twitter-api-v2";

   const client = new TwitterApi({
     appKey: process.env.TWITTER_API_KEY,
     appSecret: process.env.TWITTER_API_KEY_SECRET,
     accessToken: process.env.TWITTER_USER_TOKEN,
     accessSecret: process.env.TWITTER_USER_TOKEN_SECRET,
   });

   // Upload media (required for images)
   const mediaId = await client.v1.uploadMedia(imageBuffer);

   // Post tweet
   await client.v2.tweet({
     text: post,
     media: { media_ids: [mediaId] }
   });
   ```

**Media Upload:** Twitter requires separate media upload endpoint (v1.1) before posting.

---

### LinkedIn Integration

**File:** `src/clients/linkedin.ts`

**OAuth Flow:**

1. **Manual auth** via `yarn start:auth`
2. User visits `http://localhost:3000/auth/linkedin`
3. OAuth redirect → LinkedIn login
4. Callback with access token → Save to `.env`

**Posting:**

```typescript
import { LinkedInClient } from "./clients/linkedin";

const client = new LinkedInClient({
  accessToken: process.env.LINKEDIN_ACCESS_TOKEN,
  personUrn: process.env.LINKEDIN_PERSON_URN,
  organizationId: process.env.LINKEDIN_ORGANIZATION_ID
});

// Post to personal profile
await client.sharePost({
  text: post,
  imageUrl: image.imageUrl,
  postToOrganization: false
});

// Post to company page
await client.sharePost({
  text: post,
  imageUrl: image.imageUrl,
  postToOrganization: true
});
```

**Image Handling:** LinkedIn requires multi-step upload:
1. Register upload
2. Upload binary data
3. Reference in post creation

---

### FireCrawl - Web Scraping

**File:** `src/utils/firecrawl.ts`

**Purpose:** Extract clean markdown content from any URL

```typescript
import FirecrawlApp from "@mendable/firecrawl-js";

const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY
});

const result = await firecrawl.scrapeUrl(url, {
  formats: ["markdown", "html"],
  onlyMainContent: true
});

// Returns:
{
  markdown: "# Article Title\n\nContent...",
  html: "<html>...</html>",
  metadata: {
    title: "Article Title",
    description: "...",
    ogImage: "https://..."
  }
}
```

**Used by:** `verifyGeneralContent` node for all non-specialized URLs.

---

### Supabase - Image Storage

**File:** `src/utils/supabase.ts`

**Purpose:** Store images and generate public URLs

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Upload image
async function uploadImage(imageUrl: string, mimeType: string) {
  const imageBuffer = await fetchImageAsBuffer(imageUrl);

  const { data, error } = await supabase.storage
    .from("images")
    .upload(`posts/${Date.now()}.${ext}`, imageBuffer, {
      contentType: mimeType,
      upsert: false
    });

  // Get public URL
  const { data: publicData } = supabase.storage
    .from("images")
    .getPublicUrl(data.path);

  return publicData.publicUrl;
}
```

**Why Supabase?**
- Original URLs may expire or be blocked by social platforms
- Consistent, reliable image hosting
- Fast CDN delivery

---

### Slack Integration

**File:** `src/clients/slack/client.ts`

**Two use cases:**

1. **Ingesting URLs** (`ingest_data` graph)
   ```typescript
   import { WebClient } from "@slack/web-api";

   const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

   // Fetch messages
   const response = await slack.conversations.history({
     channel: channelId,
     oldest: timestampHoursAgo,
     limit: maxMessages
   });

   // Extract URLs from messages
   const links = extractUrlsFromSlackText(response.messages);
   ```

2. **Sending notifications** (post scheduling confirmations)
   ```typescript
   await slack.chat.postMessage({
     channel: process.env.SLACK_CHANNEL_ID,
     text: `✅ Post scheduled for ${scheduleDate}\n\n${post}`
   });
   ```

---

### YouTube - Transcript Extraction

**File:** `src/agents/shared/youtube/video-summary.ts`

**Two-step process:**

1. **Get transcript** via Google Vertex AI
   ```typescript
   import { GoogleAuth } from "google-auth-library";
   import { youtube } from "@googleapis/youtube";

   const ytClient = youtube({
     version: "v3",
     auth: new GoogleAuth({
       credentials: JSON.parse(process.env.GOOGLE_VERTEX_AI_WEB_CREDENTIALS!)
     })
   });

   const response = await ytClient.captions.download({
     id: captionId,
     tfmt: "srt"
   });

   // Parse SRT format
   const transcript = parseSRT(response.data);
   ```

2. **Summarize** with Claude
   ```typescript
   const summary = await model.invoke([
     new SystemMessage("Summarize this YouTube video transcript."),
     new HumanMessage(transcript)
   ]);
   ```

**Fallback:** If transcripts unavailable, uses video description.

---

### GitHub - Repository Content

**File:** `src/utils/github-repo-contents.ts`

**Purpose:** Extract README and repository metadata

```typescript
import { Octokit } from "@octokit/rest";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

// Get README
const { data } = await octokit.repos.getReadme({
  owner,
  repo
});

const readme = Buffer.from(data.content, "base64").toString("utf-8");

// Get repo metadata
const { data: repoData } = await octokit.repos.get({ owner, repo });

return {
  content: readme,
  stars: repoData.stargazers_count,
  description: repoData.description,
  topics: repoData.topics
};
```

**Screenshots:** Uses Playwright to capture GitHub UI for visual content.

---

## Configuration System

### Environment Variables

**File:** `.env`

**Categories:**

1. **LangSmith / Tracing**
   ```bash
   LANGCHAIN_API_KEY=lsv2_pt_...
   LANGCHAIN_TRACING_V2=true
   LANGGRAPH_API_URL=http://localhost:54367
   ```

2. **LLM APIs**
   ```bash
   ANTHROPIC_API_KEY=sk-ant-...
   GOOGLE_VERTEX_AI_WEB_CREDENTIALS={"type":"service_account",...}
   ```

3. **Social Media**
   ```bash
   # Arcade (recommended)
   ARCADE_API_KEY=...
   USE_ARCADE_AUTH=true
   TWITTER_USER_ID=user@example.com
   LINKEDIN_USER_ID=user@example.com

   # Direct APIs
   TWITTER_API_KEY=...
   TWITTER_API_KEY_SECRET=...
   TWITTER_BEARER_TOKEN=...
   TWITTER_CLIENT_ID=...
   TWITTER_CLIENT_SECRET=...
   TWITTER_USER_TOKEN=...
   TWITTER_USER_TOKEN_SECRET=...

   LINKEDIN_CLIENT_ID=...
   LINKEDIN_CLIENT_SECRET=...
   LINKEDIN_ACCESS_TOKEN=...
   LINKEDIN_PERSON_URN=...
   LINKEDIN_ORGANIZATION_ID=12345678
   POST_TO_LINKEDIN_ORGANIZATION=false
   ```

4. **External Services**
   ```bash
   FIRECRAWL_API_KEY=fc-...
   GITHUB_TOKEN=ghp_...
   SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=...
   SLACK_BOT_TOKEN=xoxb-...
   SLACK_CHANNEL_ID=C01234567
   ```

5. **Feature Flags**
   ```bash
   SKIP_CONTENT_RELEVANCY_CHECK=false
   SKIP_USED_URLS_CHECK=false
   TEXT_ONLY_MODE=false
   USE_LANGCHAIN_PROMPTS=false
   ```

### Configurable Parameters

**Runtime overrides** via LangGraph SDK:

```typescript
import { Client } from "@langchain/langgraph-sdk";

const client = new Client({ apiUrl: process.env.LANGGRAPH_API_URL });

await client.runs.create(threadId, "generate_post", {
  input: { links: ["https://example.com"] },
  config: {
    configurable: {
      // Override env vars
      textOnlyMode: true,
      skipUsedUrlsCheck: true,

      // Override accounts
      twitterUserId: "other@example.com",
      linkedinUserId: "other@example.com",

      // Post to company page
      postToLinkedInOrganization: true,

      // Custom schedule
      scheduleDate: "12/25/2024 10:00 AM PST"
    }
  }
});
```

### Prompt Customization

**File:** `src/agents/generate-post/prompts/index.ts`

**Key prompts:**

1. **BUSINESS_CONTEXT** - Define your domain
   ```typescript
   export const BUSINESS_CONTEXT = `
   Your company builds AI-powered productivity tools.
   Target audience: Software engineers and product managers.
   Key topics: AI, automation, workflow optimization, developer tools.
   `;
   ```

2. **TWEET_EXAMPLES** - Few-shot learning
   ```typescript
   export const EXAMPLES = [
     {
       content: "We just launched X feature...",
       url: "https://..."
     },
     // 5-10 examples of your best posts
   ];
   ```

3. **POST_STRUCTURE_INSTRUCTIONS** - Format guidelines
   ```typescript
   export const POST_STRUCTURE_INSTRUCTIONS = `
   <section key="1">Hook (5 words)</section>
   <section key="2">Body (3 sentences)</section>
   <section key="3">CTA (3-6 words)</section>
   `;
   ```

4. **POST_CONTENT_RULES** - Style guidelines
   ```typescript
   export const POST_CONTENT_RULES = `
   - Use present tense
   - No hashtags
   - Include link in CTA
   - Keep it conversational
   `;
   ```

---

## Testing Architecture

### Test Organization

**File structure:**
```
src/
├── tests/                     # Integration tests
│   ├── agent.test.ts         # Unit tests
│   ├── graph.int.test.ts     # Full graph execution
│   ├── twitter.int.test.ts   # Twitter API
│   ├── linkedin.int.test.ts  # LinkedIn OAuth
│   ├── github.int.test.ts    # GitHub API
│   ├── youtube.int.test.ts   # YouTube extraction
│   └── slack.int.test.ts     # Slack integration
│
├── evals/                     # Evaluation tests
│   ├── general/              # Content quality
│   ├── github/               # GitHub extraction
│   ├── youtube/              # YouTube summaries
│   ├── twitter/              # Tweet processing
│   ├── validate-images/      # Image handling
│   └── e2e/                  # End-to-end workflows
│
└── clients/twitter/tests/    # Twitter client tests
    ├── twitter.int.test.ts
    └── arcade.int.test.ts
```

### Test Commands

```bash
# Unit tests only
yarn test

# Integration tests only
yarn test:int

# Single test file
yarn test:single path/to/test.ts

# All tests + linting
yarn test:all

# Lint code
yarn lint

# Format code
yarn format

# Check formatting
yarn format:check

# Validate langgraph.json paths
yarn lint:langgraph-json
```

### Test Configuration

**File:** `jest.config.js`

```javascript
export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1"
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {
      useESM: true,
    }]
  },
  testTimeout: 20000,  // 20 seconds
  setupFiles: ["dotenv/config", "./jest.setup.cjs"],
  globals: {
    TZ: "America/Los_Angeles"  // Consistent timezone
  }
};
```

### Writing Tests

**Example integration test:**

```typescript
import { describe, it, expect } from "@jest/globals";
import { generatePostGraph } from "../agents/generate-post/generate-post-graph";

describe("Generate Post Graph", () => {
  it("should generate a post from a URL", async () => {
    const result = await generatePostGraph.invoke({
      links: ["https://blog.langchain.dev/test-article"],
      configurable: {
        textOnlyMode: true,  // Skip image handling in tests
        skipUsedUrlsCheck: true
      }
    });

    expect(result.post).toBeDefined();
    expect(result.post.length).toBeGreaterThan(0);
    expect(result.post.length).toBeLessThanOrEqual(280);
  });
});
```

### CI/CD Workflows

**File:** `.github/workflows/ci.yml`

```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: yarn install
      - run: yarn lint
      - run: yarn test
      # Integration tests run separately (require API keys)
```

---

## Deployment

### Local Development

```bash
# Start LangGraph dev server
yarn langgraph:in_mem:up

# Server runs at http://localhost:54367
# Auto-reloads on file changes
```

### LangGraph Cloud

**File:** `langgraph.json`

```json
{
  "node_version": "20",
  "graphs": {
    "generate_post": "./src/agents/generate-post/generate-post-graph.ts:generatePostGraph"
  },
  "env": ".env",
  "dependencies": ["."],
  "dockerfile_lines": [
    "RUN npx -y playwright@1.49.1 install --with-deps"
  ],
  "image_distro": "bookworm"
}
```

**Deployment:**

```bash
# Install LangGraph CLI
pip install langgraph-cli

# Deploy to cloud
langgraph deploy

# Or use Docker build
langgraph build
docker run -p 54367:54367 langgraph-image
```

### Environment Setup

**Production checklist:**

- ✅ All API keys set as environment variables
- ✅ Supabase bucket created and set to public
- ✅ Slack app installed and configured
- ✅ Twitter/LinkedIn apps created (if not using Arcade)
- ✅ LangSmith project created for tracing
- ✅ Cron jobs configured for automated ingestion

---

## Extension Points

### Adding a New URL Type

**Example: Support Product Hunt pages**

1. **Create verifier node**

   File: `src/agents/shared/nodes/verify-producthunt.ts`
   ```typescript
   export async function verifyProductHuntContent(
     state: VerifyContentAnnotation
   ) {
     const { link } = state;

     // Extract product info (use API or scraping)
     const product = await fetchProductHuntProduct(link);

     return {
       pageContents: [{
         url: link,
         content: `${product.name}: ${product.tagline}\n\n${product.description}`,
         images: [product.thumbnail]
       }],
       relevantLinks: [link]
     };
   }
   ```

2. **Add routing logic**

   File: `src/agents/verify-links/verify-links-graph.ts`
   ```typescript
   function routeLinkTypes(state: VerifyLinksAnnotation) {
     const { link } = state;

     if (link.includes("producthunt.com")) {
       return new Send("verifyProductHuntContent", { link });
     }
     // ... existing routes
   }
   ```

3. **Update graph**
   ```typescript
   const verifyLinksGraph = new StateGraph(VerifyLinksAnnotation)
     .addNode("verifyProductHuntContent", verifyProductHuntContent)
     // ... existing nodes
     .addConditionalEdges(START, routeLinkTypes, [
       "verifyProductHuntContent",
       // ... existing edges
     ]);
   ```

### Adding a New Social Platform

**Example: Support Bluesky**

1. **Create client**

   File: `src/clients/bluesky/client.ts`
   ```typescript
   import { AtpAgent } from "@atproto/api";

   export class BlueskyClient {
     private agent: AtpAgent;

     constructor() {
       this.agent = new AtpAgent({
         service: "https://bsky.social"
       });
     }

     async authenticate() {
       await this.agent.login({
         identifier: process.env.BLUESKY_USERNAME!,
         password: process.env.BLUESKY_PASSWORD!
       });
     }

     async post(text: string, imageUrl?: string) {
       let embed;

       if (imageUrl) {
         const imageBuffer = await fetchImageAsBuffer(imageUrl);
         const { data } = await this.agent.uploadBlob(imageBuffer);
         embed = {
           $type: "app.bsky.embed.images",
           images: [{ alt: "", image: data.blob }]
         };
       }

       return await this.agent.post({
         text,
         embed
       });
     }
   }
   ```

2. **Update schedulePost node**

   File: `src/agents/shared/nodes/generate-post/schedule-post.ts`
   ```typescript
   import { BlueskyClient } from "../../../clients/bluesky/client";

   export async function schedulePost(state: GeneratePostState) {
     const { post, image } = state;

     // ... existing Twitter/LinkedIn logic

     // Add Bluesky
     if (process.env.POST_TO_BLUESKY === "true") {
       const bluesky = new BlueskyClient();
       await bluesky.authenticate();
       await bluesky.post(post, image?.imageUrl);
     }

     return state;
   }
   ```

3. **Add environment variables**
   ```bash
   POST_TO_BLUESKY=true
   BLUESKY_USERNAME=...
   BLUESKY_PASSWORD=...
   ```

### Adding Custom Evaluation

**Example: Check post sentiment**

File: `src/evals/sentiment/index.ts`
```typescript
import { ChatAnthropic } from "@langchain/anthropic";

export async function evaluateSentiment(post: string) {
  const model = new ChatAnthropic({
    modelName: "claude-3-5-sonnet-20241022"
  });

  const response = await model.invoke([
    {
      role: "system",
      content: "Analyze the sentiment of this post. Return: positive, neutral, or negative."
    },
    {
      role: "user",
      content: post
    }
  ]);

  return response.content;
}

// Use in tests
describe("Post Sentiment", () => {
  it("should be positive", async () => {
    const post = "Excited to announce our new feature!";
    const sentiment = await evaluateSentiment(post);
    expect(sentiment).toBe("positive");
  });
});
```

---

## Performance Considerations

### Parallel Execution

- **verifyLinksSubGraph** processes multiple URLs concurrently
- **supervisor** graph runs data extraction in parallel
- Use `Send` API for fan-out/fan-in patterns

### Caching

**Current:** No caching implemented

**Opportunity:** Cache extracted content in LangGraph Store
```typescript
// Check cache before fetching
const cached = await store.get(["content_cache"], url);
if (cached && cached.value.timestamp > Date.now() - 86400000) {
  return cached.value.content;
}

// Fetch and cache
const content = await firecrawl.scrapeUrl(url);
await store.put(["content_cache"], url, {
  content,
  timestamp: Date.now()
});
```

### Rate Limiting

**Twitter API:** 50 tweets/15 minutes (read), 300 tweets/3 hours (write)

**Strategy:**
- Batch operations
- Use Arcade for higher limits
- Implement retry with exponential backoff

---

## Security Considerations

### API Keys

- ✅ All secrets in `.env` (never commit)
- ✅ Service role keys for Supabase (not public anon key)
- ✅ OAuth tokens with minimal scopes

### Content Validation

- ✅ MIME type checking for images
- ✅ File size limits (5MB for images)
- ✅ URL validation before fetching
- ⚠️ No XSS protection (posts are text-only, but image URLs are not sanitized)

### Recommendations

1. **Add input sanitization** for user-provided URLs
2. **Implement rate limiting** on API endpoints
3. **Add webhook signature verification** for Slack integration
4. **Use secret rotation** for long-lived tokens

---

## Monitoring & Debugging

### LangSmith Tracing

Every graph execution is traced:

```typescript
// Automatic tracing (if LANGCHAIN_TRACING_V2=true)
const result = await generatePostGraph.invoke(input);

// View in LangSmith:
// https://smith.langchain.com/
```

**Trace includes:**
- Node execution times
- LLM calls with prompts and responses
- Errors and stack traces
- State at each step

### Logging

**Console logs** throughout the codebase:

```typescript
console.log("[generatePost] Generating post for:", links);
console.log("[schedulePost] Scheduling for:", scheduleDate);
console.error("[Error]", error);
```

**Recommendation:** Implement structured logging (e.g., Winston, Pino).

### Error Handling

**Pattern:**
```typescript
try {
  const result = await someAsyncOperation();
  return result;
} catch (error) {
  console.error("[NodeName] Error:", error);
  // Option 1: Throw (fails the run)
  throw error;

  // Option 2: Return error state (continue with degraded functionality)
  return {
    ...state,
    error: error.message
  };
}
```

---

## Future Enhancements

Based on TODOs in the codebase:

### High Priority

1. **Complete evaluation logic** (`src/evals/`)
   - Implement content quality scoring
   - A/B test different prompts
   - Track post performance metrics

2. **Define repurposer schedule dates** (`src/agents/repurposer-post-interrupt/`)
   - Set R1/R2/R3 priority levels
   - Similar to P1/P2/P3 for regular posts

3. **Improve error handling** (`src/agents/shared/youtube/`)
   - Better YouTube API error messages
   - Retry logic for transient failures

### Medium Priority

4. **Replace deprecated utilities** (`src/utils/reflections.ts`)
   - Migrate to memory graph
   - Remove old reflection functions

5. **Better date validation** (`src/agents/generate-thread/nodes/human-node/`)
   - Parse and validate user-provided dates
   - Clear error messages for invalid formats

6. **Image MIME type errors** (multiple files)
   - Re-route to humanNode with error message
   - Allow user to select different image

### Low Priority

7. **Header validation** (`src/evals/e2e/`)
   - Extract and validate post structure
   - Ensure sections match instructions

8. **Slack file handling** (`src/agents/ingest-repurposed-data/`)
   - Support file uploads in Slack
   - Extract content from PDFs, docs

---

## Additional Resources

- **[LangGraph Docs](https://langchain-ai.github.io/langgraph/)** - Official framework documentation
- **[LangSmith](https://smith.langchain.com/)** - Tracing and monitoring platform
- **[Agent Inbox](https://github.com/langchain-ai/agent-inbox)** - Human-in-the-loop UI
- **[Arcade Docs](https://docs.arcade.dev/)** - Social media authentication
- **[Twitter API](https://developer.twitter.com/en/docs/twitter-api)** - Twitter API reference
- **[LinkedIn API](https://learn.microsoft.com/en-us/linkedin/)** - LinkedIn API reference

---

**This documentation is current as of the latest commit. For updates, see the [GitHub repository](https://github.com/langchain-ai/social-media-agent).**

*Last updated: 2025-11-17*
