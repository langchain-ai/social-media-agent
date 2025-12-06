# 🤝 Contributing to Social Media Agent

Thank you for your interest in contributing! This guide provides a comprehensive overview of what's implemented, what needs work, and where you can make the biggest impact.

## 📑 Table of Contents

1. [Current State](#current-state)
2. [What's Fully Implemented](#whats-fully-implemented)
3. [What's Broken or Incomplete](#whats-broken-or-incomplete)
4. [Enhancement Opportunities](#enhancement-opportunities)
5. [How to Contribute](#how-to-contribute)
6. [Development Workflow](#development-workflow)
7. [Code Style Guide](#code-style-guide)
8. [Testing Requirements](#testing-requirements)

---

## Current State

### Project Maturity: **Production-Ready with Room for Improvement**

The Social Media Agent is a **working, production-grade system** actively used by LangChain for automating social media posts. However, there are several areas where contributors can add value.

### Codebase Health

✅ **Strengths:**
- Well-structured LangGraph architecture
- Comprehensive TypeScript typing
- Good test coverage for core functionality
- Active maintenance and documentation
- Real-world usage at LangChain

⚠️ **Areas for Improvement:**
- Some evaluation modules are stubs
- Error handling could be more robust
- Missing features documented in TODOs
- Limited caching/optimization
- Python components (memory, slack-messaging) are minimal

---

## What's Fully Implemented

### ✅ Core Workflows

#### 1. **Post Generation (`generate_post`)**
**Status:** ✅ Fully functional

**Features:**
- ✅ URL content extraction (web, GitHub, YouTube, Twitter, Reddit, Luma)
- ✅ AI-powered marketing report generation
- ✅ Post generation with custom prompts
- ✅ Post condensing (if over character limit)
- ✅ Image discovery and ranking
- ✅ Human-in-the-loop review
- ✅ Twitter posting (via Arcade or direct API)
- ✅ LinkedIn posting (personal and organization)
- ✅ Scheduled posting with priority levels
- ✅ URL deduplication (prevents duplicate posts)

**File:** `src/agents/generate-post/generate-post-graph.ts`

---

#### 2. **Slack Ingestion (`ingest_data`)**
**Status:** ✅ Fully functional

**Features:**
- ✅ Fetch messages from Slack channel
- ✅ Extract URLs from messages
- ✅ Trigger `generate_post` for each URL
- ✅ Configurable message limits and time ranges
- ✅ Delayed scheduling for batch processing

**File:** `src/agents/ingest-data/ingest-data-graph.ts`

---

#### 3. **Content Curation (`curate_data`)**
**Status:** ✅ Functional, could use enhancement

**Features:**
- ✅ Aggregate content from Twitter, GitHub, Reddit
- ✅ AI newsletter extraction
- ✅ Tweet grouping by similarity
- ✅ LLM-powered reflection on tweet groups
- ⚠️ Limited to predefined sources

**Enhancement Opportunities:**
- Add more content sources (Product Hunt, Hacker News, RSS feeds)
- Improve grouping algorithm
- Add content quality scoring

**File:** `src/agents/curate-data/index.ts`

---

#### 4. **Twitter Thread Generation (`generate_thread`)**
**Status:** ✅ Fully functional

**Features:**
- ✅ Thread planning (break content into tweets)
- ✅ Sequential tweet generation
- ✅ Human review and editing
- ✅ Thread scheduling with delays

**File:** `src/agents/generate-thread/index.ts`

---

#### 5. **Content Repurposing (`repurposer`)**
**Status:** ⚠️ Functional with TODOs

**Features:**
- ✅ Campaign planning (multiple post ideas)
- ✅ Multi-post generation
- ✅ Human review for each post
- ⚠️ R1/R2/R3 schedule dates not defined (see below)

**File:** `src/agents/repurposer/index.ts`

---

### ✅ Infrastructure

#### Social Media Integrations
- ✅ **Twitter API v2** - Full support (read, write, media upload)
- ✅ **LinkedIn OAuth** - Personal and organization posting
- ✅ **Arcade Authentication** - Unified social media auth
- ✅ **Reddit API** - Content extraction
- ✅ **Slack API** - Message ingestion and notifications

#### Content Extraction
- ✅ **FireCrawl** - General web scraping
- ✅ **GitHub API** - Repository README extraction
- ✅ **YouTube API** - Video transcripts and summaries
- ✅ **Twitter API** - Tweet extraction
- ✅ **Reddit API** - Post and comment extraction
- ✅ **Luma API** - Event details

#### Storage & Utilities
- ✅ **Supabase** - Image storage with public URLs
- ✅ **LangGraph Store** - URL deduplication tracking
- ✅ **Date/Timezone handling** - PST-aware scheduling
- ✅ **LangSmith tracing** - Full observability

---

## What's Broken or Incomplete

### 🔴 High Priority Issues

#### 1. **Repurposer Schedule Dates Undefined**

**Issue:** R1/R2/R3 priority levels for repurposed posts have no defined schedule times.

**Location:** `src/agents/repurposer-post-interrupt/nodes/human-node/utils.ts:143-145`

**Code:**
```typescript
- **R1**: TODO: WHAT SCHEDULE DATE FOR R1
- **R2**: TODO: WHAT SCHEDULE DATE FOR R2
- **R3**: TODO: WHAT SCHEDULE DATE FOR R3
```

**Impact:** Users can't select R1/R2/R3 priorities for repurposed posts.

**Fix Required:**
- Define schedule times similar to P1/P2/P3
- Update `src/utils/schedule-date/constants.ts`
- Test with repurposer graph

**Difficulty:** 🟢 Easy

**Estimated Effort:** 1-2 hours

---

#### 2. **Incomplete Evaluation Modules**

**Issue:** Several evaluation modules contain placeholder logic.

**Locations:**
- `src/evals/youtube/index.ts:24`
- `src/evals/general/index.ts:24`
- `src/evals/twitter/index.ts:24`

**Code:**
```typescript
export async function evaluate(input: string, output: string) {
  // TODO: Implement evaluation logic
  return { score: 0, feedback: "" };
}
```

**Impact:** No automated quality scoring for generated content.

**Fix Required:**
- Implement LLM-based evaluation
- Define scoring rubrics (relevance, tone, structure)
- Add test cases

**Difficulty:** 🟡 Intermediate

**Estimated Effort:** 4-8 hours per module

---

#### 3. **YouTube Error Handling**

**Issue:** Some YouTube operations silently fail or have poor error messages.

**Location:** `src/agents/shared/nodes/youtube.utils.ts:87`

**Code:**
```typescript
} catch (error) {
  // TODO: Handle this better
  console.error("YouTube error:", error);
  return null;
}
```

**Impact:** Users get unclear errors when YouTube extraction fails.

**Fix Required:**
- Add specific error messages for common failures
- Implement retry logic for transient errors
- Fall back to video description if transcript unavailable

**Difficulty:** 🟡 Intermediate

**Estimated Effort:** 2-4 hours

---

### 🟡 Medium Priority Issues

#### 4. **Deprecated Reflection Utilities**

**Issue:** Old reflection functions should be replaced with memory graph.

**Location:** `src/utils/reflections.ts:50,69`

**Code:**
```typescript
/**
 * @deprecated - use `getReflectionsPrompt` instead.
 */
export function oldReflectionFunction() { ... }
```

**Impact:** Code duplication and maintenance burden.

**Fix Required:**
- Migrate all usages to new memory graph
- Remove deprecated functions
- Update tests

**Difficulty:** 🟡 Intermediate

**Estimated Effort:** 3-5 hours

---

#### 5. **Invalid Date Handling**

**Issue:** User-provided dates aren't validated properly.

**Location:** `src/agents/generate-thread/nodes/human-node/index.ts:229`

**Code:**
```typescript
const scheduleDate = parseScheduleDate(userInput);
// TODO: Handle invalid dates better
```

**Impact:** Confusing errors when users provide invalid date formats.

**Fix Required:**
- Add date validation with clear error messages
- Provide example formats in error message
- Re-prompt user if date is invalid

**Difficulty:** 🟢 Easy

**Estimated Effort:** 1-2 hours

---

#### 6. **Image MIME Type Errors**

**Issue:** When blacklisted MIME types are selected, errors aren't user-friendly.

**Locations:**
- `src/agents/generate-thread/nodes/human-node/index.ts:250`
- `src/agents/shared/nodes/generate-post/human-node.ts:287`

**Code:**
```typescript
// TODO: Update so if the mime type is blacklisted, it re-routes to human node with an error message.
```

**Impact:** Users see technical errors instead of helpful guidance.

**Fix Required:**
- Check MIME type before processing
- Return to humanNode with friendly error
- Suggest alternative images

**Difficulty:** 🟡 Intermediate

**Estimated Effort:** 2-3 hours

---

### 🟢 Low Priority Issues

#### 7. **Extract Headers from E2E Tests**

**Issue:** E2E tests don't validate post structure.

**Location:** `src/evals/e2e/e2e.int.test.ts:67`

**Code:**
```typescript
// TODO: Extract headers and validate they are correct
```

**Impact:** No automated validation of post structure adherence.

**Fix Required:**
- Parse post sections
- Validate against POST_STRUCTURE_INSTRUCTIONS
- Add assertions

**Difficulty:** 🟢 Easy

**Estimated Effort:** 1-2 hours

---

#### 8. **Slack File Upload Support**

**Issue:** Repurposed data ingestion doesn't handle file uploads.

**Location:** `src/agents/ingest-repurposed-data/nodes/extract.ts:123`

**Code:**
```typescript
// TODO: Update Slack message handler to include fileIds
```

**Impact:** Can't repurpose content from PDF/doc files shared in Slack.

**Fix Required:**
- Detect file attachments in Slack messages
- Download and extract text
- Pass to repurposer graph

**Difficulty:** 🔴 Advanced

**Estimated Effort:** 6-10 hours

---

#### 9. **Thread Plan Parsing**

**Issue:** Thread count extraction uses regex instead of LLM.

**Location:** `src/agents/generate-thread/nodes/generate-thread-plan.ts:96`

**Code:**
```typescript
// TODO: Make this pass to an LLM and have the LLM extract the number.
const count = parseInt(plan.match(/\d+/)?.[0] ?? "1");
```

**Impact:** Fragile parsing that may fail on unconventional responses.

**Fix Required:**
- Use structured output from Claude
- Add validation and retry logic

**Difficulty:** 🟢 Easy

**Estimated Effort:** 1-2 hours

---

#### 10. **Minimal Python Components**

**Issue:** `memory-v2/` and `slack-messaging/` directories are underdeveloped.

**Status:**
- `memory-v2/README.md` - Only 1 line
- `slack-messaging/` - Basic implementation exists but no integration with main graphs

**Impact:** Limited memory features and standalone Slack integration.

**Fix Required:**
- Complete memory graph implementation
- Integrate with TypeScript graphs
- Document usage

**Difficulty:** 🔴 Advanced

**Estimated Effort:** 10-20 hours

---

## Enhancement Opportunities

### 🚀 Feature Additions

#### 1. **Add New Content Sources**

**Opportunity:** Expand content aggregation beyond current sources.

**Suggestions:**
- Product Hunt daily/weekly digests
- Hacker News trending posts
- RSS feed aggregation
- Substack newsletters
- Medium publications
- Dev.to articles

**Difficulty:** 🟡 Intermediate

**Impact:** ⭐⭐⭐ High

**Files to modify:**
- `src/agents/curate-data/nodes/ingest-data.ts`
- Create new verifier in `src/agents/shared/nodes/`

---

#### 2. **Add New Social Platforms**

**Opportunity:** Support additional social media platforms.

**Suggestions:**
- Bluesky (decentralized Twitter alternative)
- Mastodon (open-source federated platform)
- Threads (Meta's Twitter competitor)
- Discord (community messaging)

**Difficulty:** 🟡 Intermediate to 🔴 Advanced

**Impact:** ⭐⭐⭐⭐ Very High

**Files to create:**
- `src/clients/{platform}/client.ts`
- Update `src/agents/shared/nodes/generate-post/schedule-post.ts`

**Starter Template:**
```typescript
export class BlueskyClient {
  async authenticate() { ... }
  async post(text: string, imageUrl?: string) { ... }
  async uploadMedia(buffer: Buffer) { ... }
}
```

---

#### 3. **Implement Content Caching**

**Opportunity:** Reduce API calls by caching extracted content.

**Benefits:**
- Faster re-processing of URLs
- Lower API costs
- Better reliability

**Implementation:**
- Use LangGraph Store with TTL
- Cache FireCrawl results
- Cache YouTube transcripts
- Cache GitHub README files

**Difficulty:** 🟡 Intermediate

**Impact:** ⭐⭐⭐ High

**Files to modify:**
- `src/agents/shared/nodes/verify-content.ts`
- `src/utils/firecrawl.ts`
- `src/agents/shared/youtube/video-summary.ts`

**Example:**
```typescript
// Check cache
const cached = await store.get(["content_cache"], url);
if (cached && !isExpired(cached.value.timestamp)) {
  return cached.value.content;
}

// Fetch and cache
const content = await firecrawl.scrapeUrl(url);
await store.put(["content_cache"], url, {
  content,
  timestamp: Date.now()
});
```

---

#### 4. **Build Analytics Dashboard**

**Opportunity:** Track post performance and optimize prompts.

**Features:**
- Post engagement metrics (likes, retweets, comments)
- A/B test different prompts
- Best time to post analysis
- Content type performance

**Difficulty:** 🔴 Advanced

**Impact:** ⭐⭐⭐⭐⭐ Critical

**New components needed:**
- Database schema for metrics
- Twitter/LinkedIn API polling for engagement
- Dashboard UI (React)
- Analytics API endpoints

---

#### 5. **Improve Image Selection**

**Opportunity:** Better image ranking and selection algorithm.

**Current:** Simple relevance scoring by Claude

**Enhancements:**
- Detect faces and prioritize
- Analyze image colors (prefer vibrant)
- Check image dimensions (prefer 16:9 for Twitter)
- Use vision model for quality assessment
- A/B test image performance

**Difficulty:** 🟡 Intermediate

**Impact:** ⭐⭐⭐ High

**Files to modify:**
- `src/agents/find-images/nodes/re-rank-images.ts`
- `src/agents/find-images/nodes/validate-images.ts`

---

#### 6. **Smart Post Scheduling**

**Opportunity:** ML-based optimal posting time prediction.

**Current:** Fixed priority levels (P1/P2/P3)

**Enhancements:**
- Learn from historical engagement data
- Account for day of week, time of day
- Detect trending topics and prioritize
- Avoid posting during low-engagement periods

**Difficulty:** 🔴 Advanced

**Impact:** ⭐⭐⭐⭐ Very High

**New components needed:**
- Historical data collection
- ML model training
- Scheduling optimizer

---

#### 7. **Multi-Language Support**

**Opportunity:** Generate posts in multiple languages.

**Implementation:**
- Detect source content language
- Generate posts in target languages
- Maintain tone/style across languages
- Support language-specific social platforms (e.g., Weibo for Chinese)

**Difficulty:** 🟡 Intermediate

**Impact:** ⭐⭐⭐ High

**Files to modify:**
- Add language parameter to state
- Update prompts to specify target language
- Add language detection to content extraction

---

#### 8. **Hashtag and Emoji Suggestions**

**Opportunity:** Optional hashtag/emoji generation.

**Current:** No hashtags or emojis (by design)

**Enhancement:** Make it configurable
- LLM generates relevant hashtags
- Emoji suggestions for visual appeal
- Platform-specific optimization (Twitter vs. LinkedIn)

**Difficulty:** 🟢 Easy

**Impact:** ⭐⭐ Medium

**Files to modify:**
- `src/agents/generate-post/prompts/index.ts`
- Add configurable flag for hashtags/emojis

---

#### 9. **Competitor Analysis**

**Opportunity:** Analyze competitor posts for insights.

**Features:**
- Track competitor social media accounts
- Identify successful post patterns
- Suggest content ideas based on gaps
- Benchmark engagement metrics

**Difficulty:** 🔴 Advanced

**Impact:** ⭐⭐⭐⭐ Very High

**New graph needed:**
- `analyze_competitors` graph
- Competitor tracking configuration
- Pattern recognition with LLM

---

#### 10. **Content Calendar Integration**

**Opportunity:** Integrate with external calendar tools.

**Platforms:**
- Google Calendar
- Notion
- Airtable
- Trello

**Features:**
- Sync scheduled posts to calendar
- Block out posting times
- Visual content planning
- Collaborative editing

**Difficulty:** 🟡 Intermediate

**Impact:** ⭐⭐⭐ High

---

### 🔧 Code Quality Improvements

#### 1. **Add Structured Logging**

**Current:** `console.log` statements

**Improvement:** Use logging library (Winston, Pino)

**Benefits:**
- Log levels (debug, info, warn, error)
- Structured JSON logs
- Log aggregation (Datadog, Splunk)

**Difficulty:** 🟢 Easy

**Impact:** ⭐⭐ Medium

---

#### 2. **Improve Error Handling**

**Current:** Inconsistent error handling

**Improvement:**
- Custom error classes
- Retry logic for transient failures
- User-friendly error messages
- Error reporting (Sentry)

**Difficulty:** 🟡 Intermediate

**Impact:** ⭐⭐⭐ High

---

#### 3. **Add Input Validation**

**Current:** Limited validation

**Improvement:**
- Zod schemas for all state interfaces
- URL validation
- Date validation
- Image URL validation

**Difficulty:** 🟢 Easy

**Impact:** ⭐⭐⭐ High

---

#### 4. **Expand Test Coverage**

**Current:** ~28 test files, good coverage for core

**Improvement:**
- Unit tests for all utility functions
- Integration tests for all graphs
- E2E tests for full workflows
- Visual regression tests for images

**Difficulty:** 🟡 Intermediate

**Impact:** ⭐⭐⭐⭐ Very High

---

#### 5. **Performance Optimization**

**Opportunities:**
- Profile slow nodes
- Optimize LLM token usage
- Reduce API calls
- Implement connection pooling

**Difficulty:** 🟡 Intermediate to 🔴 Advanced

**Impact:** ⭐⭐⭐ High

---

## How to Contribute

### 1. **Choose a Task**

Pick from:
- 🔴 High priority issues (biggest impact)
- 🚀 Feature additions (most exciting)
- 🔧 Code quality improvements (best for learning)

### 2. **Discuss First**

For major changes:
1. Open a GitHub issue describing your proposal
2. Tag maintainers for feedback
3. Wait for approval before starting

For minor fixes:
1. Just submit a PR!

### 3. **Fork and Clone**

```bash
# Fork on GitHub, then:
git clone https://github.com/YOUR_USERNAME/social-media-agent.git
cd social-media-agent
git checkout -b feature/my-awesome-feature
```

### 4. **Make Changes**

- Follow the [Code Style Guide](#code-style-guide)
- Add tests for new functionality
- Update documentation

### 5. **Test Thoroughly**

```bash
# Run tests
yarn test        # Unit tests
yarn test:int    # Integration tests
yarn lint        # Linting
yarn format      # Code formatting

# Manual testing
yarn langgraph:in_mem:up
yarn generate_post
```

### 6. **Submit PR**

```bash
git add .
git commit -m "feat: Add support for Bluesky posting"
git push origin feature/my-awesome-feature
```

Open a PR on GitHub with:
- Clear description of changes
- Link to related issue
- Screenshots (if UI changes)
- Test results

---

## Development Workflow

### Setup

```bash
# Install dependencies
yarn install

# Set up environment
cp .env.quickstart.example .env
# Edit .env with your API keys

# Start dev server
yarn langgraph:in_mem:up
```

### Development Loop

```bash
# In terminal 1: Dev server
yarn langgraph:in_mem:up

# In terminal 2: Run tests on file changes
yarn test --watch

# In terminal 3: Manual testing
yarn generate_post
```

### Debugging

**Use LangSmith:**
1. Set `LANGCHAIN_TRACING_V2=true`
2. Run your graph
3. View trace at https://smith.langchain.com/

**Use Agent Inbox:**
1. Start graph server
2. Visit https://dev.agentinbox.ai
3. Add local graph
4. Review interrupts visually

---

## Code Style Guide

### TypeScript

**Naming:**
```typescript
// PascalCase for types/interfaces/classes
interface GeneratePostState { ... }
class TwitterClient { ... }

// camelCase for variables/functions
const pageContents = [];
async function generatePost() { ... }

// SCREAMING_SNAKE_CASE for constants
const MAX_RETRIES = 3;
const TEXT_ONLY_MODE = "textOnlyMode";
```

**Async/Await:**
```typescript
// ✅ Good
async function fetchData() {
  try {
    const result = await api.fetch();
    return result;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

// ❌ Bad
function fetchData() {
  return api.fetch().then(result => result);
}
```

**Type Safety:**
```typescript
// ✅ Good
function processPost(state: GeneratePostState): GeneratePostState {
  return { ...state, processed: true };
}

// ❌ Bad
function processPost(state: any): any {
  return { ...state, processed: true };
}
```

### File Organization

```typescript
// 1. Imports (external, then internal)
import { StateGraph } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";

import { GeneratePostState } from "./state";
import { generatePost } from "./nodes/generate-post";

// 2. Constants
const MAX_RETRIES = 3;

// 3. Types/Interfaces
interface Config {
  apiKey: string;
}

// 4. Functions
async function main() {
  // ...
}

// 5. Exports
export { main, Config };
```

### Comments

```typescript
// ✅ Good: Explain WHY, not WHAT
// Retry 3 times because Twitter API is occasionally flaky
const MAX_RETRIES = 3;

// ❌ Bad: Obvious comment
// Set max retries to 3
const MAX_RETRIES = 3;
```

### Prompts

```typescript
// ✅ Good: Clear, structured
const SYSTEM_PROMPT = `
You are a social media expert.

Context:
{context}

Task:
Generate a tweet that:
- Is under 280 characters
- Includes a call to action
- Uses present tense
`.trim();

// ❌ Bad: Hard to read
const SYSTEM_PROMPT = "You are a social media expert. Context: {context}. Task: Generate a tweet that: Is under 280 characters, Includes a call to action, Uses present tense.";
```

---

## Testing Requirements

### Unit Tests

**Required for:**
- All utility functions
- Date parsing/formatting
- URL extraction
- Text processing

**Example:**
```typescript
import { describe, it, expect } from "@jest/globals";
import { extractUrls } from "../utils";

describe("extractUrls", () => {
  it("should extract URLs from text", () => {
    const text = "Check out https://example.com";
    const urls = extractUrls(text);
    expect(urls).toEqual(["https://example.com"]);
  });

  it("should handle multiple URLs", () => {
    const text = "See https://a.com and https://b.com";
    const urls = extractUrls(text);
    expect(urls).toHaveLength(2);
  });
});
```

### Integration Tests

**Required for:**
- New graphs
- New nodes
- External API integrations
- Authentication flows

**Example:**
```typescript
import { describe, it, expect } from "@jest/globals";
import { generatePostGraph } from "../generate-post-graph";

describe("Generate Post Graph", () => {
  it("should generate a post", async () => {
    const result = await generatePostGraph.invoke({
      links: ["https://blog.langchain.dev/test"],
      configurable: {
        textOnlyMode: true,
        skipUsedUrlsCheck: true
      }
    });

    expect(result.post).toBeDefined();
    expect(result.post.length).toBeLessThanOrEqual(280);
  });
});
```

### Before Submitting PR

```bash
# All checks must pass
yarn test          # ✅
yarn test:int      # ✅
yarn lint          # ✅
yarn format:check  # ✅
```

---

## Quick Reference: Files to Know

### Core Graph Files
- `src/agents/generate-post/generate-post-graph.ts` - Main workflow
- `src/agents/verify-links/verify-links-graph.ts` - Content extraction routing
- `src/agents/curate-data/index.ts` - Multi-source aggregation

### Key Node Files
- `src/agents/shared/nodes/generate-post/schedule-post.ts` - Posting logic
- `src/agents/shared/nodes/generate-post/human-node.ts` - HITL interrupt
- `src/agents/find-images/nodes/re-rank-images.ts` - Image selection

### Client Files
- `src/clients/twitter/client.ts` - Twitter API
- `src/clients/linkedin.ts` - LinkedIn OAuth
- `src/clients/slack/client.ts` - Slack integration

### Utility Files
- `src/utils/date.ts` - Date/timezone handling
- `src/utils/firecrawl.ts` - Web scraping
- `src/agents/utils.ts` - URL extraction, text processing

### Configuration
- `src/agents/generate-post/prompts/index.ts` - Customizable prompts
- `src/agents/generate-post/constants.ts` - Configurable parameters
- `langgraph.json` - Graph deployment config

---

## Getting Help

### Resources

- **[START_HERE.md](./START_HERE.md)** - Beginner's guide
- **[SYSTEM_OVERVIEW.md](./SYSTEM_OVERVIEW.md)** - Deep technical docs
- **[README.md](./README.md)** - Setup instructions
- **[LangGraph Docs](https://langchain-ai.github.io/langgraph/)** - Framework documentation

### Community

- **GitHub Issues** - Ask questions, report bugs
- **GitHub Discussions** - General discussion
- **LangChain Discord** - Real-time help

---

## Recognition

All contributors will be:
- ✅ Added to `CONTRIBUTORS.md`
- ✅ Credited in release notes
- ✅ Mentioned in project README

Significant contributors may be offered:
- 🎁 LangChain swag
- 🌟 Co-author credit on blog posts
- 💼 Job opportunities at LangChain

---

## Thank You!

Your contributions make this project better for everyone. Whether you fix a typo or build a major feature, every contribution matters. Happy coding! 🚀

**Questions?** Open an issue or reach out to the maintainers.

*Last updated: 2025-11-17*
