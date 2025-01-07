import { z } from "zod";
import { getModelFromConfig } from "../../../utils.js";
import { LangGraphRunnableConfig } from "@langchain/langgraph";

const ROUTE_RESPONSE_PROMPT = `You are an AI assistant tasked with routing a user's response to one of two possible routes based on their intention. The two possible routes are:

1. Rewrite post - The user's response indicates they want to rewrite the generated post.
2. Update scheduled date - The user wants to update the scheduled date for the post. This can either be a new date or a priority level (P1, P2, P3).

Here is the generated post:
<post>
{POST}
</post>

Here is the current date/priority level for scheduling the post:
<date-or-priority>
{DATE_OR_PRIORITY}
</date-or-priority>

Carefully analyze the user's response:
<user-response>
{USER_RESPONSE}
</user-response>

Based on the user's response, determine which of the two routes they intend to take. Consider the following:

1. If the user mentions editing, changing, or rewriting the content of the post, choose the "rewrite_post" route.
2. If the user mentions changing the date, time, or priority level of the post, choose the "update_date" route.

Provide your answer in the following format:
<explanation>
[A brief explanation of why you chose this route based on the user's response]
</explanation>
(call the 'route' tool to choose the route)

Here are some examples of possible user responses and the corresponding routes:

Example 1:
User: "Can we change the wording in the second paragraph?"
Route: rewrite_post
Explanation: The user is requesting changes to the content of the post.

Example 2:
User: "Schedule this for next Tuesday."
Route: update_date
Explanation: The user wants to change the posting date.

Example 3:
User: "This should be a P1 priority."
Route: update_date
Explanation: The user wants to change the priority level of the post.

Remember to always base your decision on the actual content of the user's response, not on these examples.`;

interface RouteResponseArgs {
  post: string;
  dateOrPriority: string;
  userResponse: string;
  config: LangGraphRunnableConfig;
}

export async function routeResponse({
  post,
  dateOrPriority,
  userResponse,
  config,
}: RouteResponseArgs) {
  const model = await getModelFromConfig(config, {
    temperature: 0,
  });

  const routeSchema = z.object({
    route: z.enum(["rewrite_post", "update_date"]),
  });
  const modelWithSchema = model.withStructuredOutput(routeSchema, {
    name: "route",
  });

  const formattedPrompt = ROUTE_RESPONSE_PROMPT.replace("{POST}", post)
    .replace("{DATE_OR_PRIORITY}", dateOrPriority)
    .replace("{USER_RESPONSE}", userResponse);

  const result = await modelWithSchema.invoke([
    {
      role: "user",
      content: formattedPrompt,
    },
  ]);

  return result;
}
