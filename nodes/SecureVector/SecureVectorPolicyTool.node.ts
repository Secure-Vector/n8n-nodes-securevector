/**
 * SecureVectorPolicyTool — AI Agent tool sub-node.
 *
 * Mirrors the shape of `@n8n/nodes-langchain` Call n8n Workflow Tool:
 *   inputs: []
 *   outputs: ['ai_tool']
 *   supplyData() returns a LangChain StructuredTool
 *
 * The Agent sees this node as ONE callable tool with a fixed name and
 * description. When the Agent's LLM picks it:
 *
 *   1. We POST to the SecureVector local app:
 *      /api/tool-permissions/call-audit   (with action derived from the check)
 *   2. We call the user-supplied sub-workflow that performs the REAL tool
 *      action (Gmail Send, HTTP Request, etc.) only when the check says allow.
 *   3. On block, we return `{ blocked: true, reason }` so the Agent's next
 *      turn can apologize gracefully. The sub-workflow never runs.
 *
 * This is the ONLY way to machine-enforce a pre-tool policy check inside
 * an n8n AI Agent — prompt-engineering the Agent to "always check first"
 * is unreliable. See plan §"Diagram 2b".
 */

import {
  INodeType,
  INodeTypeDescription,
  ISupplyDataFunctions,
  SupplyData,
  NodeConnectionTypes,
  NodeOperationError,
} from 'n8n-workflow';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { validateLocalBaseUrl } from './validation';

export class SecureVectorPolicyTool implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'SecureVector Policy Tool',
    name: 'secureVectorPolicyTool',
    icon: 'file:securevector.svg',
    group: ['transform'],
    version: 1,
    description:
      'Wrap a real n8n sub-workflow (Gmail, HTTP, Slack, etc.) with a SecureVector policy check. Attach to an AI Agent as a tool; the Agent sees one opaque tool name, SecureVector decides allow/block and logs every invocation.',
    defaults: {
      name: 'SecureVector Policy Tool',
    },
    codex: {
      categories: ['AI'],
      subcategories: {
        AI: ['Tools'],
      },
    },
    inputs: [],
    outputs: [NodeConnectionTypes.AiTool],
    outputNames: ['Tool'],
    properties: [
      {
        displayName: 'Tool Name (shown to LLM)',
        name: 'toolName',
        type: 'string',
        required: true,
        default: '',
        placeholder: 'secure_gmail_send',
        description:
          'Name the AI Agent will see for this tool. Use snake_case, no spaces. Example: secure_gmail_send, secure_http_fetch.',
      },
      {
        displayName: 'Tool Description (shown to LLM)',
        name: 'toolDescription',
        type: 'string',
        required: true,
        default: '',
        placeholder:
          'Send an email via Gmail. Returns {blocked: true, reason} when SecureVector policy denies the call.',
        description:
          'What the LLM reads as the tool spec. Must describe both the success path AND the block-branch shape so the agent handles refusals gracefully.',
        typeOptions: {
          rows: 3,
        },
      },
      {
        displayName: 'SecureVector Tool ID',
        name: 'securevectorToolId',
        type: 'string',
        required: true,
        default: '',
        placeholder: 'Gmail.send',
        description:
          'The SecureVector tool_id this tool maps to (must match what appears in the app\'s Tool Permissions UI). Used for the pre-call check and the audit log row.',
      },
      {
        displayName: 'Real Target Workflow ID',
        name: 'realTargetWorkflowId',
        type: 'string',
        required: true,
        default: '',
        placeholder: '1234',
        description:
          'ID of an n8n workflow that performs the real tool action (e.g. a workflow whose trigger is Execute Workflow and body is a Gmail Send node). The PolicyTool calls this workflow with the Agent\'s tool args when the check passes.',
      },
      {
        displayName: 'Local Base URL',
        name: 'localBaseUrl',
        type: 'string',
        default: 'http://127.0.0.1:8741',
        placeholder: 'http://127.0.0.1:8741',
        description:
          'URL of the SecureVector local app (loopback only). This sub-node is local-only because policy checks never leave the device.',
      },
    ],
  };

  // eslint-disable-next-line @typescript-eslint/require-await
  async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
    const toolName = (this.getNodeParameter('toolName', itemIndex, '') as string).trim();
    const toolDescription = (this.getNodeParameter('toolDescription', itemIndex, '') as string).trim();
    const securevectorToolId = (
      this.getNodeParameter('securevectorToolId', itemIndex, '') as string
    ).trim();
    const realTargetWorkflowId = (
      this.getNodeParameter('realTargetWorkflowId', itemIndex, '') as string
    ).trim();
    const baseUrlRaw = this.getNodeParameter(
      'localBaseUrl',
      itemIndex,
      'http://127.0.0.1:8741',
    ) as string;

    if (!toolName) {
      throw new NodeOperationError(this.getNode(), 'Tool Name is required', { itemIndex });
    }
    if (!toolDescription) {
      throw new NodeOperationError(this.getNode(), 'Tool Description is required', { itemIndex });
    }
    if (!securevectorToolId) {
      throw new NodeOperationError(this.getNode(), 'SecureVector Tool ID is required', { itemIndex });
    }
    if (!realTargetWorkflowId) {
      throw new NodeOperationError(this.getNode(), 'Real Target Workflow ID is required', { itemIndex });
    }

    const baseUrl = validateLocalBaseUrl(baseUrlRaw);
    const nodeHelpers = this.helpers;
    const executeWorkflow = this.executeWorkflow.bind(this);

    // Schema notes:
    //   The arg shape varies per real-target tool, but OpenAI's strict
    //   function-calling mode rejects schemas that declare `type: object`
    //   without explicit `properties`.
    //
    //   We pass a plain JSON Schema (NOT zod) directly to LangChain's
    //   DynamicStructuredTool. This bypasses zod-version skew between our
    //   package and n8n's @langchain/core (which historically caused the
    //   schema to lose its `properties` envelope on serialize).
    //
    //   Single string parameter `args_json` is JSON-stringified by the LLM
    //   and parsed on the func side. This is the pattern the OpenAI
    //   Assistants API itself uses for free-form tool arguments, and it
    //   passes strict mode on every provider (OpenAI, Anthropic, Gemini,
    //   MiniMax, etc.).
    const schema = {
      type: 'object' as const,
      properties: {
        args_json: {
          type: 'string' as const,
          description:
            'JSON-encoded object with the arguments to forward to the real tool when the policy check passes. Example: \'{"to":"alice@example.com","subject":"hi","body":"..."}\'. Use \'{}\' if no arguments are needed.',
        },
      },
      required: ['args_json'],
      additionalProperties: false,
      description: toolDescription,
    };

    const tool = new DynamicStructuredTool({
      name: toolName,
      description: toolDescription,
      schema,
      func: async (input: { args_json?: string }): Promise<string> => {
        // Parse the JSON-stringified args. If malformed, return a "blocked"
        // shape so the agent's next turn handles it like a real policy block
        // rather than a thrown exception.
        let args: Record<string, unknown> = {};
        if (input?.args_json) {
          try {
            const parsed: unknown = JSON.parse(input.args_json);
            args = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
          } catch {
            return JSON.stringify({
              blocked: true,
              reason: 'args_json was not valid JSON. Please pass a JSON-encoded object string.',
            });
          }
        }

        // ---------- 1. pre-call permission check ----------
        let action: 'allow' | 'block' | 'log_only' = 'log_only';
        let reason = '';
        let risk = '';
        try {
          const [essential, custom] = await Promise.all([
            nodeHelpers.httpRequest({
              method: 'GET',
              url: `${baseUrl}/api/tool-permissions/essential`,
              json: true,
            }) as Promise<{ tools?: Array<Record<string, unknown>> }>,
            nodeHelpers.httpRequest({
              method: 'GET',
              url: `${baseUrl}/api/tool-permissions/custom`,
              json: true,
            }) as Promise<{ tools?: Array<Record<string, unknown>> }>,
          ]);
          const rows = [...(essential.tools ?? []), ...(custom.tools ?? [])];
          // Case-insensitive match: workflows commonly write tool IDs in
          // mixed case ("Gmail.send") while the local app's catalog stores
          // them lowercase ("gmail.send"). Strict equality silently
          // bypasses the policy check, defaulting to log_only — which is
          // a safety regression. Compare case-insensitively.
          const wantedLower = securevectorToolId.toLowerCase();
          const match = rows.find(
            (r) => typeof r.tool_id === 'string' && r.tool_id.toLowerCase() === wantedLower,
          );
          if (match) {
            // Essential tools expose a computed `effective_action` (default
            // overlaid with user override). Custom tools only expose
            // `default_permission` — there is no override layer for them
            // because the user IS setting the value directly. Fall back so
            // a custom tool registered with default_permission="block"
            // actually blocks instead of silently allowing.
            action =
              (match.effective_action as 'allow' | 'block' | 'log_only') ??
              (match.default_permission as 'allow' | 'block' | 'log_only') ??
              'allow';
            reason = (match.reason as string) ?? '';
            risk = (match.risk as string) ?? '';
          } else {
            action = 'log_only';
            reason = 'Tool not registered with SecureVector; default policy applied.';
            risk = 'unknown';
          }
        } catch (err) {
          // If the local app is unreachable, fail SAFE — block the call
          // and surface a message the Agent can relay. Users running an
          // AI Agent without their SecureVector app up should see the
          // failure, not get silent allow behaviour.
          const msg = (err as Error).message ?? 'SecureVector local app unreachable';
          return JSON.stringify({
            blocked: true,
            reason: `SecureVector check failed: ${msg}. Verify the local app is running at ${baseUrl}.`,
          });
        }

        // ---------- 2. either execute the real workflow or block ----------
        if (action === 'block') {
          // Log the block decision.
          await nodeHelpers
            .httpRequest({
              method: 'POST',
              url: `${baseUrl}/api/tool-permissions/call-audit`,
              body: {
                tool_id: securevectorToolId,
                function_name: toolName,
                action: 'block',
                reason,
                risk,
                args_preview: truncate(JSON.stringify(args), 512),
                is_essential: false,
              },
              json: true,
            })
            // Never let logging break the user-facing block flow.
            .catch(() => undefined);

          return JSON.stringify({
            blocked: true,
            reason: reason || 'Denied by SecureVector policy.',
          });
        }

        // Allow / log_only: run the real sub-workflow.
        // `executeWorkflow` returns `ExecuteWorkflowData = { executionId, data: [] }`.
        // We hand the LLM the sub-workflow's ACTUAL output (first item's json),
        // not the n8n execution envelope — the agent must see real tool data.
        let result: unknown;
        try {
          const exec = (await executeWorkflow(
            { id: realTargetWorkflowId },
            [{ json: { args } }],
          )) as { data?: Array<Array<{ json?: unknown }> | null> };
          const firstItemJson = exec?.data?.[0]?.[0]?.json;
          result = firstItemJson ?? {};
        } catch (err) {
          const msg = (err as Error).message ?? 'unknown';
          // Even on real-tool failure, we still audit the attempt.
          await nodeHelpers
            .httpRequest({
              method: 'POST',
              url: `${baseUrl}/api/tool-permissions/call-audit`,
              body: {
                tool_id: securevectorToolId,
                function_name: toolName,
                action: action,
                reason: `sub-workflow error: ${msg}`,
                risk,
                args_preview: truncate(JSON.stringify(args), 512),
                is_essential: false,
              },
              json: true,
            })
            .catch(() => undefined);
          return JSON.stringify({
            error: `Sub-workflow failed: ${msg}`,
          });
        }

        // Log the successful (or log_only) invocation.
        await nodeHelpers
          .httpRequest({
            method: 'POST',
            url: `${baseUrl}/api/tool-permissions/call-audit`,
            body: {
              tool_id: securevectorToolId,
              function_name: toolName,
              action,
              reason,
              risk,
              args_preview: truncate(JSON.stringify(args), 512),
              is_essential: false,
            },
            json: true,
          })
          .catch(() => undefined);

        // executeWorkflow's return shape varies by n8n version; coerce to string.
        return typeof result === 'string' ? result : JSON.stringify(result ?? {});
      },
    });

    return { response: tool };
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
