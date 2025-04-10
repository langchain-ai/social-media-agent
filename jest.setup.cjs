const dotenv = require("dotenv");

// Check for TEST_ENV environment variable to determine which .env file to load
// Default to regular .env if not specified

const envFile =
  process.env.TEST_ENV === "production" ? ".env.production" : ".env";

// Load the appropriate .env file
dotenv.config({ path: envFile });
