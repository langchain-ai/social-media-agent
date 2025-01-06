export const INPUTS = [
  {
    report: `News TL;DR: An Intelligent News Processing Agent

The News TL;DR agent is an innovative open-source solution developed by Jason Sheinkopf during a LangChain hackathon. This sophisticated system transforms how users consume news by intelligently processing, analyzing, and summarizing articles across multiple sources. Instead of overwhelming users with content, it delivers concise, meaningful insights by understanding the context and relevance of news articles.


LangChain Implementation

The system is built on LangGraph, which serves as the foundation for orchestrating complex workflows and decision-making processes. LangGraph enables the agent to:



Dynamically adapt its search and analysis strategies

Process multiple articles in parallel

Make intelligent decisions about content relevance

Orchestrate the flow between different components (query processing, news collection, analysis, and summarization)


Technical Deep Dive

The agent implements several sophisticated components:



Query processor for understanding user intent

News collection engine using NewsAPI integration

Content analysis pipeline with web scraping capabilities

Intelligent article selection system

Cross-article summary generation


The entire implementation is available as an open-source tutorial at: https://github.com/NirDiamant/GenAI_Agents/blob/main/all_agents_tutorials/news_tldr_langgraph.ipynb


This project demonstrates how LangGraph can be used to build practical, production-ready AI applications that solve real-world information processing challenges. The system's ability to adapt its approach dynamically and process multiple articles in parallel showcases the power of LangGraph's workflow orchestration capabilities.`,
    post: `📰 News TL;DR Agent

Meet your intelligent news assistant that analyzes multiple articles simultaneously to deliver concise insights. Built with LangGraph, this open-source agent processes news in parallel, scores content relevance, and generates cross-article summaries.

Learn how to build your own news processing agent 🔍
https://diamantai.substack.com/p/stop-reading-start-understanding`,
    imageOptions: [
      "https://verdyqfuvvtxtygqekei.supabase.co/storage/v1/object/public/images/screenshot-diamantai.substack.com-1735869048739.jpeg", // 0 - approved
      "https://substackcdn.com/image/fetch/w_96,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F84bf24d0-f0ec-49fc-8e8f-800eec27706d_1280x1280.png", // 1 - not
      "https://substackcdn.com/image/fetch/w_80,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F6cacafa3-9e4a-49d6-afde-2239493e73a3_6960x4640.jpeg", // 2 - not
      "https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F19c2d967-34c9-472c-92a5-508a5fa46855_360x730.png", // 3 - approved
      "https://substackcdn.com/image/fetch/w_80,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F9fea2024-a403-469d-9c4e-e7bc06882275_640x550.png", // 4 - not
      "https://substackcdn.com/image/fetch/w_80,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fce9d2e8d-2701-4ad1-a761-02d6167a02e7_96x96.png", // 5 - not
      "https://substackcdn.com/image/fetch/w_80,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F8d78d477-471b-43f2-9770-38418f9e64bd_500x500.png", // 6 - not
      "https://substackcdn.com/image/fetch/w_80,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F637a9f66-65c3-40eb-916e-5952936e24d5_490x464.png", // 7 - not
      "https://substackcdn.com/image/fetch/w_80,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fa59ae4c4-030a-45f4-8d0f-42e75c0e12c5_96x96.jpeg", // 8 - not
      "https://substackcdn.com/image/fetch/w_32,h_32,c_fill,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack.com%2Fimg%2Favatars%2Fdefault-light.png", // 9 - not
      "https://substackcdn.com/image/fetch/w_32,h_32,c_fill,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F3f00ef95-0cc4-439b-9c92-f56a34ee59eb_256x256.png", // 10 - not
      "https://substackcdn.com/image/fetch/w_32,h_32,c_fill,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F8d9cbdb7-eb66-40c2-8c60-2ba9b461f69c_1170x1170.png", // 11 - not
      "https://substackcdn.com/image/fetch/w_320,h_213,c_fill,f_auto,q_auto:good,fl_progressive:steep,g_auto/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F7731cfa7-fc73-473b-bb49-fabac7432086_1792x1024.png", // 12 - maybe
      "https://substackcdn.com/image/fetch/w_320,h_213,c_fill,f_auto,q_auto:good,fl_progressive:steep,g_auto/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F916fbcb0-447f-42b6-8635-71e71e6280b5_1024x1024.png", // 13 - maybe
      "https://substackcdn.com/image/fetch/w_320,h_213,c_fill,f_auto,q_auto:good,fl_progressive:steep,g_auto/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Feefc7325-a910-410d-9fb2-04bf0d38fe2e_1024x1024.png", // 4 - maybe
    ],
  },
  {
    report: `# Marketing Report: Learn How to Build AI Agents & Chatbots with LangGraph

## Introduction & Summary
LangGraph, an open-source framework from LangChain, enables developers to build sophisticated AI agents and multi-agent systems. This comprehensive tutorial demonstrates how to create AI applications, including chatbots, using LangGraph's powerful state management and agent interaction capabilities. The content provides a practical, hands-on approach with working code examples and implementation details.

## LangChain Implementation
The tutorial leverages two key LangChain products:
- **LangGraph**: The core framework used throughout the tutorial for building the AI agents and chatbot application. The content demonstrates LangGraph's key components - nodes, states, and edges - showing how they work together to create agentic applications.
- **LangSmith**: Used for tracing and monitoring the application, with the tutorial showing how to set up LangSmith API keys and enable tracing for development.

## Technical Details
The tutorial provides an in-depth technical implementation including:
- Detailed explanation of LangGraph's architecture using nodes, states, and edges
- Step-by-step code examples showing how to create a basic chatbot
- Integration with LLM services and state management
- Complete working example with a GitHub repository (https://github.com/pavanbelagatti/LangGraph-Chatbot-Tutorial)
- Environment setup instructions using SingleStore notebooks
- Code samples for creating StateGraphs and implementing chat functionality

The content serves as both an introduction to LangGraph and a practical implementation guide, making it valuable for developers looking to build AI applications using LangChain's tools.`,
    post: `📚 Build AI Agents with LangGraph

A hands-on tutorial that walks you through building AI agents and chatbots using LangGraph, complete with working code examples and a full GitHub repository. Perfect for developers ready to create their first agentic application.

Ready to start building? Check out the tutorial 👉 https://levelup.gitconnected.com/learn-how-to-build-ai-agents-chatbots-with-langgraph-1fe09c4558c6`,
    imageOptions: [
      "https://verdyqfuvvtxtygqekei.supabase.co/storage/v1/object/public/images/screenshot-levelup.gitconnected.com-1735950183280.jpeg", // yes
      "https://miro.medium.com/v2/resize:fill:88:88/1*BCvL6b99GdWbNEo79BF1sQ.jpeg",
      "https://miro.medium.com/v2/resize:fill:48:48/1*5D9oYBd58pyjMkV_5-zXXQ.jpeg",
      "https://miro.medium.com/v2/resize:fit:700/1*pvsQBbW2fTYhvYcQIMCt3w.png", // yes
      "https://miro.medium.com/v2/resize:fit:700/1*xwU1Nf9qpggbIB73CGaNRg.png", // yes
      "https://miro.medium.com/v2/resize:fit:700/1*ldsEjgVFdxhpcKtgc9ddvQ.png", // yes
      "https://miro.medium.com/v2/resize:fit:328/1*DiUoE5bztatRHtzwr1Tc5Q.png",
      "https://miro.medium.com/v2/resize:fill:96:96/1*5D9oYBd58pyjMkV_5-zXXQ.jpeg",
      "https://miro.medium.com/v2/resize:fill:128:128/1*5D9oYBd58pyjMkV_5-zXXQ.jpeg",
      "https://miro.medium.com/v2/resize:fill:48:48/1*AiTJDz5wwQFiUCf_SrBOQA.jpeg",
      "https://miro.medium.com/v2/resize:fill:48:48/1*zjPggFS8yoRtFbAP9R_3lw.jpeg",
      "https://miro.medium.com/v2/resize:fill:48:48/1*PNVLDmurJ5LoCjB9Ovdnpw.png",
      "https://miro.medium.com/v2/resize:fill:48:48/1*rex1OZ5_KcxK2QrsZr3Cgw.jpeg",
      "https://miro.medium.com/v2/resize:fill:20:20/1*R8zEd59FDf0l8Re94ImV0Q.png",
    ],
  },
];

export const OUTPUTS = [
  {
    imageOptions: [
      "https://verdyqfuvvtxtygqekei.supabase.co/storage/v1/object/public/images/screenshot-diamantai.substack.com-1735869048739.jpeg", // 0 - approved
      "https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F19c2d967-34c9-472c-92a5-508a5fa46855_360x730.png", // 3 - approved
    ],
  },
  {
    imageOptions: [
      "https://verdyqfuvvtxtygqekei.supabase.co/storage/v1/object/public/images/screenshot-levelup.gitconnected.com-1735950183280.jpeg", // yes
      "https://miro.medium.com/v2/resize:fit:700/1*pvsQBbW2fTYhvYcQIMCt3w.png", // yes
      "https://miro.medium.com/v2/resize:fit:700/1*xwU1Nf9qpggbIB73CGaNRg.png", // yes
      "https://miro.medium.com/v2/resize:fit:700/1*ldsEjgVFdxhpcKtgc9ddvQ.png", // yes
    ],
  },
];