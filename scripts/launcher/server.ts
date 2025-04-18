import express, { Request, Response, Router, RequestHandler } from 'express';
import { spawn } from 'child_process';
import Arcade from "@arcadeai/arcadejs";
import path, { resolve } from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Check if the right environment variables are set
if (!process.env.ARCADE_API_KEY) {
  console.error("ERROR: ARCADE_API_KEY environment variable is not set.");
  console.error("Please make sure your .env file contains the ARCADE_API_KEY variable.");
  console.error("If you're running the server with 'yarn ui', try restarting the server.");
}

if (!process.env.ARCADE_USER_ID) {
  console.error("ERROR: ARCADE_USER_ID environment variable is not set.");
  console.error("Please make sure your .env file contains the ARCADE_USER_ID variable.");
  console.error("If you're running the server with 'yarn ui', try restarting the server.");
}
// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const router = Router();

const arcadeClient = new Arcade({ apiKey: process.env.ARCADE_API_KEY });

app.use(express.json());
app.use(express.static(__dirname));

// Main HTML page
const getMainPage: RequestHandler = (req, res) => {
  // Read the index.html file from the launcher directory
  const indexPath = path.join(__dirname, 'index.html');
  fs.readFile(indexPath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading index.html:', err);
      res.status(500).send('Error loading the page');
      return;
    }
    res.send(data);
  });
};

// Common function to process URLs
const processUrls = async (urls: string[], mode: string, res: Response, sse: boolean = true) => {
  console.log("processing urls", urls);
  if (!urls || urls.length === 0) {
    if (sse) {
      sendEvent(res, "error", 'No URLs provided');
    } else {
      res.json({ error: 'No URLs provided' });
    }
    return;
  }

  const child = spawn('yarn', [
    'generate_multiple_posts',
    '--urls=' + urls.join(','),
    '--mode=' + (mode || 'multi-post')
  ]);

  let output = '';

  child.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
    output += data.toString();
  });

  child.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
    output += data.toString();
  });

  child.on('close', (code) => {
    if (code !== 0) {
      if (sse) {
        sendEvent(res, "error", `Command failed with code ${code}`);
      } else {
        res.json({ error: `Command failed with code ${code}` });
      }
      return;
    }
    if (sse) {
      sendEvent(res, "message", output || 'Command executed successfully!');
    } else {
      res.json({ output: output || 'Command executed successfully!' });
    }
  });
};

// Handle URLs from the UI
const submitUrls: RequestHandler = async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  req.on('close', () => {
      console.log("closing connection");
      res.end();
  });
  console.log("req.query", req.query);
  const url = req.query.url as string;
  const urls = req.query.urls as string;
  const mode = req.query.mode as string;
  if (!url && !urls) {
    sendEvent(res, "error", 'No URLs provided');
    return;
  }
  if (!mode) {
    sendEvent(res, "error", 'Mode is required');
    return;
  }

  try {
    let urlList: string[] = [];

    // Handle single URL
    if (url) {
      urlList = [url];
    }
    // Handle multiple URLs
    else if (urls) {
      urlList = urls.split(',').map((url: string) => url.trim());
    }

    for (const url of urlList) {
      sendEvent(res, "url", {message: 'Processing URL: ', url: url});
    }

    await processUrls(urlList, mode, res, true);
  } catch (error: any) {
    sendEvent(res, "error", error.message || 'An unknown error occurred');
  }
  sendEvent(res, "end", "end");
};

// Parse Notion formatted URLs into label/url pairs
const parseNotionURLs = (text: string): Array<{label: string, url: string, page_id: string}> => {
  console.log("parsing markdown urls from", text);
  const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const matches = Array.from(text.matchAll(markdownLinkRegex));

  return matches.map(match => ({
    label: match[1],
    url: match[2],
    page_id: match[2].split('-').pop() || '',
  }));
};
// Parse markdown formatted URLs into label/url pairs
const parseMarkdownURLs = (text: string): Array<{label: string, url: string}> => {
  console.log("parsing markdown urls from", text);
  const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const matches = Array.from(text.matchAll(markdownLinkRegex));

  return matches.map(match => ({
    label: match[1],
    url: match[2]
  }));
};

const getNotionPageContent = async (query: string, isPageId: boolean = false): Promise<{error: boolean, contents: string}> => {
  const tool_name = isPageId ? 'NotionToolkit.GetPageContentById' : 'NotionToolkit.GetPageContentByTitle';
  const input = isPageId ? {
    page_id: query
  } : {
    title: query
  };
  const contents = await arcadeClient.tools.execute({
    tool_name: tool_name,
    user_id: process.env.ARCADE_USER_ID,
    input: input
  });
  console.log("contents", contents);
  if (contents.status === 'success' && !contents.output?.error) {
    return {error:false, contents: contents.output?.value as string};
  } else {
    if (contents.output?.error) {
      return {error: true, contents: contents.output?.error.message};
    } else {
      return {error: true, contents: 'Unknown error'};
    }
  }
};

// Handle Notion integration
const submitNotion: RequestHandler = async (req, res) => {
  // Set headers to keep the connection alive and tell the client we're sending event-stream data
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  req.on('close', () => {
      console.log("closing connection");
      res.end();
  });
  console.log("req.query", req.query);
  const notionPageTitle = req.query.notionPageTitle as string;
  const mode = req.query.mode as string;
  if (!notionPageTitle || !mode) {
    if (!notionPageTitle) {
      sendEvent(res, "error", 'Notion page title is required');
    }
    if (!mode) {
      sendEvent(res, "error", 'Mode is required');
    }
    sendEvent(res, "end", "end");
    return;
  } else {
    // Send an initial message
    sendEvent(res, "message", `Processing Notion page: ${notionPageTitle}`);

    const tool_name = 'NotionToolkit.GetPageContentByTitle';
    // Use arcade to handle the auth
    const authResponse = await arcadeClient.tools.authorize({
      tool_name: tool_name,
      user_id: process.env.ARCADE_USER_ID,
    });

    console.log("authResponse", authResponse);

    if (authResponse.status !== 'completed') {
      sendEvent(res, "auth_required", authResponse.url || '');
    } else {
      try {
        // Get links from Notion using the extract-notion-links script
        console.log(`Retrieving Notion page: ${notionPageTitle}`);
        const {error, contents} = await getNotionPageContent(notionPageTitle);
        if (error) {
          sendEvent(res, "error", contents);
          sendEvent(res, "end", "end");
          return;
        }
        const urls = parseNotionURLs(contents);
        console.log("link collection urls", urls);
        sendEvent(res, "message", `Found ${urls.length} links in the Notion page:`);
        for (const url of urls) {
          sendEvent(res, "message", `- ${url.label}`);
        }

        const allUrls: string[] = [];
        for (const url of urls) {
          sendEvent(res, "message", `Getting content for ${url.label}`);
          const {error, contents} = await getNotionPageContent(url.page_id, true);
          if (error) {
            sendEvent(res, "error", contents);
            sendEvent(res, "end", "end");
            return;
          }
          const contentUrls = parseMarkdownURLs(contents);
          const firstUrl = contentUrls[0];
          // we only want the first url from each content page, as that's the URL to the original source
          sendEvent(res, "url", {message: 'added URL: ', url: firstUrl.url});
          allUrls.push(firstUrl.url);
        }

        if (allUrls.length === 0) {
          sendEvent(res, "error", 'No links found in the Notion page');
          sendEvent(res, "end", "end");
          return;
        }

        // Process the links
        await processUrls(allUrls, mode, res, true);
      } catch (error: any) {
        sendEvent(res, "error", error.message || 'An unknown error occurred');
      }
    }

    sendEvent(res, "end", "end");
    // When client closes connection, stop sending events
  }

};

const sendEvent = (res: Response, type: string, data: any) => {
  res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
};

// Register routes
router.get('/', getMainPage);
router.get('/submit-urls', submitUrls);
router.get('/submit-notion', submitNotion);

app.use('/', router);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
