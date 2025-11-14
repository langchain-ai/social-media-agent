import { z } from "zod";
import { ChatAnthropic } from "@langchain/anthropic";

const ROUTE_POST_PROMPT = `You're an advanced AI assistant, tasked with routing a user's response.
The only route which can be taken is 'rewrite_post'. If the user is not asking to rewrite a post, then choose the 'unknown_response' route.

Here's the post the user is responding to:
<post>
{POST}
</post>

Here's the user's response:
<user-response>
{USER_RESPONSE}
</user-response>

Please examine the {POST_OR_POSTS} and determine which route to take.
`;

const routeResponseSchema = z.object({
  route: z.enum(["rewrite_post", "unknown_response"]),
});

export async function routeResponse(
  post: string,
  userResponse: string,
): Promise<z.infer<typeof routeResponseSchema>> {
  const model = new ChatAnthropic({
    model: "claude-sonnet-4-5",
    temperature: 0,
  }).bindTools(
    [
      {
        name: "route_response",
        description: "Route the user's response to the appropriate route.",
        schema: routeResponseSchema,
      },
    ],
    {
      tool_choice: "route_response",
    },
  );

  const formattedPrompt = ROUTE_POST_PROMPT.replace("{POST}", post).replace(
    "{USER_RESPONSE}",
    userResponse,
  );

  const response = await model.invoke(formattedPrompt);

  return response.tool_calls?.[0].args as z.infer<typeof routeResponseSchema>;
}
