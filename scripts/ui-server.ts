import express, { Request, Response, RequestHandler } from 'express';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import Arcade from "@arcadeai/arcadejs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../static')));

// List of available commands
const availableCommands = [
  {
    id: 'generate_post',
    name: 'Generate Post',
    hasUrlParam: true,
    defaultUrl: 'https://blog.langchain.dev/customers-appfolio/'
  },
  {
    id: 'generate_multiple_posts',
    name: 'Generate Multiple Posts',
    hasMultipleUrls: true,
    hasModeSelection: true,
    defaultUrls: 'https://blog.langchain.dev/customers-appfolio/,https://blog.langchain.dev/customers-appfolio/',
    defaultMode: 'multi-post'
  },
  {
    id: 'ingest_urls',
    name: 'Ingest URLs',
    hasMultipleUrls: true,
    defaultUrls: 'https://blog.langchain.dev/customers-appfolio/,https://blog.langchain.dev/customers-appfolio/'
  },
  {
    id: 'ingest_from_notion',
    name: 'Ingest URLs from Notion',
    hasNotionPageTitle: true,
    defaultNotionPageTitle: 'My Notion Page'
  }
];

// Serve the main HTML page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Command Runner UI</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
          }
          .command-list {
            display: grid;
            gap: 10px;
            margin-top: 20px;
          }
          .command-button {
            padding: 15px;
            background: #fff;
            border: 1px solid #ddd;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
          }
          .command-button:hover {
            background: #f0f0f0;
            transform: translateY(-1px);
          }
          .output {
            margin-top: 20px;
            padding: 15px;
            background: #fff;
            border-radius: 8px;
            border: 1px solid #ddd;
            white-space: pre-wrap;
          }
          h1 {
            color: #333;
            margin-bottom: 20px;
          }
          .url-input {
            width: 100%;
            padding: 8px;
            margin-top: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
          }
          .command-container {
            background: #fff;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #ddd;
            margin-bottom: 10px;
          }
          .mode-selector {
            width: 100%;
            padding: 8px;
            margin-top: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
          }
          .help-text {
            font-size: 12px;
            color: #666;
            margin-top: 5px;
          }
          .auth-container {
            display: none;
            margin-top: 10px;
            padding: 10px;
            background: #f8f8f8;
            border-radius: 4px;
            border: 1px solid #ddd;
          }
          .auth-url {
            word-break: break-all;
            margin-bottom: 10px;
          }
          .auth-buttons {
            display: flex;
            gap: 10px;
          }
          .auth-button {
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          }
          .auth-accept {
            background: #4CAF50;
            color: white;
            border: none;
          }
          .auth-cancel {
            background: #f44336;
            color: white;
            border: none;
          }
          .section-title {
            font-size: 18px;
            font-weight: bold;
            margin-top: 20px;
            margin-bottom: 10px;
            color: #333;
          }
        </style>
      </head>
      <body>
        <h1>Command Runner UI</h1>

        <div class="section-title">URL Ingestion</div>
        <div class="command-list">
          ${availableCommands.filter(cmd => cmd.id === 'ingest_urls').map(cmd => `
            <div class="command-container">
              <button class="command-button" onclick="runCommand('${cmd.id}')">
                ${cmd.name}
              </button>
              ${cmd.hasMultipleUrls ? `
                <input type="text"
                       id="urls-${cmd.id}"
                       class="url-input"
                       placeholder="Enter URLs (comma-separated)"
                       value="${cmd.defaultUrls || ''}"
                >
                <div class="help-text">Enter multiple URLs separated by commas</div>
              ` : ''}
            </div>
          `).join('')}
        </div>

        <div class="section-title">Notion Integration</div>
        <div class="command-list">
          ${availableCommands.filter(cmd => cmd.id === 'ingest_from_notion').map(cmd => `
            <div class="command-container">
              <button class="command-button" onclick="runCommand('${cmd.id}')">
                ${cmd.name}
              </button>
              ${cmd.hasNotionPageTitle ? `
                <input type="text"
                       id="notion-page-title-${cmd.id}"
                       class="url-input"
                       placeholder="Enter Notion Page Title"
                       value="${cmd.defaultNotionPageTitle || ''}"
                >
                <div class="help-text">Enter the title of the Notion page to extract links from</div>
                <div id="notion-auth-${cmd.id}" class="auth-container">
                  <div class="auth-url" id="notion-auth-url-${cmd.id}"></div>
                  <div class="auth-buttons">
                    <button class="auth-button auth-accept" onclick="handleNotionAuth('${cmd.id}', 'accept')">I've Authorized</button>
                    <button class="auth-button auth-cancel" onclick="handleNotionAuth('${cmd.id}', 'cancel')">Cancel</button>
                  </div>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>

        <div class="section-title">Post Generation</div>
        <div class="command-list">
          ${availableCommands.filter(cmd => cmd.id === 'generate_post' || cmd.id === 'generate_multiple_posts').map(cmd => `
            <div class="command-container">
              <button class="command-button" onclick="runCommand('${cmd.id}')">
                ${cmd.name}
              </button>
              ${cmd.hasUrlParam ? `
                <input type="text"
                       id="url-${cmd.id}"
                       class="url-input"
                       placeholder="Enter URL"
                       value="${cmd.defaultUrl || ''}"
                >
              ` : ''}
              ${cmd.hasMultipleUrls ? `
                <input type="text"
                       id="urls-${cmd.id}"
                       class="url-input"
                       placeholder="Enter URLs (comma-separated)"
                       value="${cmd.defaultUrls || ''}"
                >
                <div class="help-text">Enter multiple URLs separated by commas</div>
              ` : ''}
              ${cmd.hasModeSelection ? `
                <select id="mode-${cmd.id}" class="mode-selector">
                  <option value="multi-post" ${cmd.defaultMode === 'multi-post' ? 'selected' : ''}>Multi-Post Mode</option>
                  <option value="single-post" ${cmd.defaultMode === 'single-post' ? 'selected' : ''}>Single-Post Mode</option>
                </select>
                <div class="help-text">Multi-Post: Process each URL separately. Single-Post: Process all URLs together.</div>
              ` : ''}
            </div>
          `).join('')}
        </div>

        <div id="output" class="output"></div>

        <script>
          async function runCommand(command) {
            const output = document.getElementById('output');
            output.textContent = 'Running command...';

            const commandConfig = ${JSON.stringify(availableCommands)};
            const cmd = commandConfig.find(c => c.id === command);

            let commandData = { command };

            if (cmd?.hasUrlParam) {
              const urlInput = document.getElementById(\`url-\${command}\`);
              commandData.url = urlInput.value;
            }

            if (cmd?.hasMultipleUrls) {
              const urlsInput = document.getElementById(\`urls-\${command}\`);
              const modeSelect = document.getElementById(\`mode-\${command}\`);
              commandData.urls = urlsInput.value;
              commandData.mode = modeSelect.value;
            }

            if (cmd?.hasNotionPageTitle) {
              const notionPageTitleInput = document.getElementById(\`notion-page-title-\${command}\`);
              commandData.notionPageTitle = notionPageTitleInput.value;
            }

            try {
              const response = await fetch('/run-command', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(commandData),
              });

              const data = await response.json();

              if (data.authUrl) {
                // Show Notion auth UI
                const authContainer = document.getElementById(\`notion-auth-\${command}\`);
                const authUrl = document.getElementById(\`notion-auth-url-\${command}\`);
                authContainer.style.display = 'block';
                authUrl.textContent = data.authUrl;
                output.textContent = 'Notion authorization required. Please visit the URL above and click "I\'ve Authorized" when done.';
                return;
              }

              output.textContent = data.output;
            } catch (error) {
              output.textContent = 'Error: ' + error.message;
            }
          }

          async function handleNotionAuth(command, action) {
            const output = document.getElementById('output');
            const authContainer = document.getElementById(\`notion-auth-\${command}\`);

            if (action === 'cancel') {
              authContainer.style.display = 'none';
              output.textContent = 'Notion authorization cancelled.';
              return;
            }

            output.textContent = 'Checking authorization...';

            try {
              const response = await fetch('/check-notion-auth', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ command }),
              });

              const data = await response.json();

              if (data.authUrl) {
                // Still needs auth
                output.textContent = 'Authorization still needed. Please visit the URL and try again.';
                return;
              }

              // Auth successful, run the command
              const notionPageTitleInput = document.getElementById(\`notion-page-title-\${command}\`);
              const commandData = {
                command,
                notionPageTitle: notionPageTitleInput.value
              };

              const runResponse = await fetch('/run-command', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(commandData),
              });

              const runData = await runResponse.json();
              output.textContent = runData.output;
              authContainer.style.display = 'none';
            } catch (error) {
              output.textContent = 'Error: ' + error.message;
            }
          }
        </script>
      </body>
    </html>
  `);
});

// Endpoint to run commands
const runCommandHandler: RequestHandler = async (req, res) => {
  const { command, url, urls, mode, notionPageTitle } = req.body;

  if (!availableCommands.find(cmd => cmd.id === command)) {
    res.status(400).json({ error: 'Invalid command' });
    return;
  }

  const cmd = availableCommands.find(cmd => cmd.id === command);
  let commandString = '';

  // Handle Notion page ingestion
  if (cmd?.id === 'ingest_from_notion' && notionPageTitle) {
    try {
      // Check if user is authorized
      const notionUserId = process.env.NOTION_USER_ID;
      if (!notionUserId) {
        res.status(400).json({ error: 'NOTION_USER_ID environment variable is required' });
        return;
      }

      try {
        // Use Arcade directly for authentication
        const arcade = new Arcade({ apiKey: process.env.ARCADE_API_KEY });
        const authRes = await arcade.auth.start(notionUserId, "notion", {
          scopes: ["read"],
        });

        if (!authRes.context?.token) {
          // Return the auth URL to the client
          res.json({ authUrl: authRes.url });
          return;
        }
      } catch (error: any) {
        if (error.message.includes('authorization is still needed')) {
          // Return the auth URL to the client
          res.json({ authUrl: error.message.split('Please visit ')[1].split(' to')[0] });
          return;
        }
        throw error;
      }

      // User is authorized, run the command
      commandString = `yarn extract-notion-links "${notionPageTitle}"`;
    } catch (error: any) {
      res.json({ output: 'Error: ' + error.message });
      return;
    }
  } else if (cmd?.id === 'ingest_urls' && urls) {
    // Handle direct URL ingestion
    commandString = `yarn generate_multiple_posts --urls="${urls}" --mode=multi-post`;
  } else if (cmd?.hasUrlParam && url) {
    commandString = 'yarn ' + command + ' --url=' + url;
  } else if (cmd?.hasMultipleUrls && urls && mode) {
    commandString = 'yarn ' + command + ' --mode=' + mode + ' --urls=' + urls;
  } else {
    commandString = 'yarn ' + command;
  }

  exec(commandString, (error, stdout, stderr) => {
    if (error) {
      res.json({ output: 'Error: ' + error.message + '\n' + stderr });
      return;
    }
    res.json({ output: stdout || 'Command executed successfully' });
  });
};

// Endpoint to check Notion authorization
app.post('/check-notion-auth', async (req, res) => {
  const notionUserId = process.env.NOTION_USER_ID;
  if (!notionUserId) {
    res.status(400).json({ error: 'NOTION_USER_ID environment variable is required' });
    return;
  }

  try {
    // Use Arcade directly for authentication
    const arcade = new Arcade({ apiKey: process.env.ARCADE_API_KEY });
    const authRes = await arcade.auth.start(notionUserId, "notion", {
      scopes: ["read"],
    });

    if (!authRes.context?.token) {
      // Return the auth URL to the client
      res.json({ authUrl: authRes.url });
      return;
    }

    // If we get here, the user is authorized
    res.json({ authorized: true });
  } catch (error: any) {
    if (error.message.includes('authorization is still needed')) {
      // Return the auth URL to the client
      res.json({ authUrl: error.message.split('Please visit ')[1].split(' to')[0] });
    } else {
      res.json({ error: error.message });
    }
  }
});

app.post('/run-command', runCommandHandler);

app.listen(port, () => {
  console.log('UI server running at http://localhost:' + port);
});
