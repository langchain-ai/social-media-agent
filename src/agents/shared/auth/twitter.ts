// @ts-expect-error - The type is used in the JSDoc comment, but not defined in the code.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { interrupt, type NodeInterrupt } from "@langchain/langgraph";
import { HumanInterrupt, HumanResponse } from "@langchain/langgraph/prebuilt";
import Arcade from "@arcadeai/arcadejs";
import { TwitterClient } from "../../../clients/twitter/client.js";

/**
 * Checks Twitter authorization status and triggers an interrupt if authorization is needed.
 * This function attempts to authorize both tweet lookup and posting capabilities.
 * If either authorization is missing, it will interrupt the flow to request user authorization.
 *
 * @param twitterUserId - The user ID for Twitter authorization
 * @param arcade - The Arcade instance used for tool authorization
 * @throws {NodeInterrupt} When authorization is needed, throws an interrupt to request user action
 * @returns {Promise<HumanInterrupt | undefined>} A promise that resolves to the interrupt if `options.returnInterrupt` is true, or undefined if `options.returnInterrupt` is false
 *
 * @example
 * ```typescript
 * await getArcadeTwitterAuthOrInterrupt("user123", arcadeInstance);
 * ```
 */
export async function getArcadeTwitterAuthOrInterrupt(
  twitterUserId: string,
  arcade: Arcade,
  options?: {
    returnInterrupt?: boolean;
  },
) {
  const authResponse = await TwitterClient.authorizeUser(twitterUserId, arcade);

  const authUrl = authResponse.authorizationUrl;

  if (authUrl) {
    const description = `# Authorization Required
  
Please visit the following URL to authorize reading & posting Tweets.

${authUrl}

----

If you have already authorized reading/posting on Twitter, please accept this interrupt event.`;

    const authInterrupt: HumanInterrupt = {
      action_request: {
        action: "[AUTHORIZATION REQUIRED]: Twitter",
        args: {
          authorizeTwitterURL: authUrl,
        },
      },
      config: {
        allow_ignore: true,
        allow_accept: true,
        allow_edit: false,
        allow_respond: false,
      },
      description,
    };

    if (options?.returnInterrupt) {
      return authInterrupt;
    }

    const res = interrupt<HumanInterrupt[], HumanResponse[]>([
      authInterrupt,
    ])[0];
    if (res.type === "accept") {
      // This means that the user has accepted, however the
      // authorization is still needed. Throw an error.
      throw new Error(
        "User accepted authorization, but authorization is still needed.",
      );
    } else if (res.type === "ignore") {
      // Throw an error to end the graph.
      throw new Error("Authorization denied by user.");
    }
  }

  return undefined;
}

export async function getBasicTwitterAuthOrInterrupt(options?: {
  returnInterrupt?: boolean;
}) {
  const authInterrupt: HumanInterrupt = {
    action_request: {
      action: "[AUTHORIZATION REQUIRED]: Twitter",
      args: {},
    },
    config: {
      allow_ignore: true,
      allow_accept: true,
      allow_edit: false,
      allow_respond: false,
    },
    description:
      "Failed to fetch user authorization status.\n\nPlease ensure the proper Twitter credentials and user secrets are set in the environment.",
  };

  try {
    const client = TwitterClient.fromBasicTwitterAuth();
    const authed = await client.testAuthentication();
    if (authed) {
      // User is successfully authed. Return undefined.
      return undefined;
    }
  } catch (error: any) {
    if (typeof error === "object" && error?.message) {
      // Use error message in interrupt description
      authInterrupt.description = `Failed to fetch user authorization status.\n\n${error.message}`;
    }
  }

  if (options?.returnInterrupt) {
    return authInterrupt;
  }

  const res = interrupt<HumanInterrupt[], HumanResponse[]>([authInterrupt])[0];
  if (res.type === "accept") {
    // This means that the user has accepted, however the
    // authorization is still needed. Throw an error.
    throw new Error(
      "User accepted authorization, but authorization is still needed.",
    );
  } else if (res.type === "ignore") {
    // Throw an error to end the graph.
    throw new Error("Authorization denied by user.");
  }

  return undefined;
}

export async function getTwitterAuthOrInterrupt(fields?: {
  twitterUserId?: string;
  returnInterrupt?: boolean;
}) {
  const useArcadeAuth = process.env.USE_ARCADE_AUTH;
  if (useArcadeAuth === "true") {
    if (!fields?.twitterUserId) {
      throw new Error("Must provide Twitter User ID when using Arcade auth.");
    }

    return getArcadeTwitterAuthOrInterrupt(
      fields.twitterUserId,
      new Arcade({ apiKey: process.env.ARCADE_API_KEY }),
      {
        returnInterrupt: fields?.returnInterrupt,
      },
    );
  }

  return getBasicTwitterAuthOrInterrupt({
    returnInterrupt: fields?.returnInterrupt,
  });
}
