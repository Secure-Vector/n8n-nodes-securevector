import { INodeProperties } from 'n8n-workflow';

// ---------------------------------------------------------------------------
// Transport + Local Base URL live at the top of every operation.
//
// Transport defaults to "cloud" so every workflow saved under v0.1.5
// continues to work byte-identically — no `transport` field in the saved
// JSON resolves to the default value on load.
// ---------------------------------------------------------------------------

export const secureVectorOperations: INodeProperties[] = [
  {
    displayName: 'Transport',
    name: 'transport',
    type: 'options',
    noDataExpression: true,
    options: [
      {
        name: 'Cloud (scan.securevector.io)',
        value: 'cloud',
        description:
          'Use the hosted SecureVector API. Requires a SecureVector API key. Only Scan operations are available.',
      },
      {
        name: 'Local App (127.0.0.1:8741)',
        value: 'local',
        description:
          'Talk to a SecureVector AI Threat Monitor app running on this machine. No API key required. Unlocks tool-audit, cost tracking, budget checks, and device ID operations.',
      },
    ],
    default: 'cloud',
    description:
      'Which SecureVector backend to use. Cloud is the verified-default (unchanged from v0.1.5). Local App requires the SecureVector desktop app running on this machine.',
  },
  {
    displayName: 'Local Base URL',
    name: 'localBaseUrl',
    type: 'string',
    default: 'http://127.0.0.1:8741',
    placeholder: 'http://127.0.0.1:8741',
    description:
      'URL of the SecureVector local app. Loopback only — must be http://127.0.0.1:<port> or http://localhost:<port>. Default port is 8741.',
    displayOptions: {
      show: {
        transport: ['local'],
      },
    },
  },
  {
    displayName: 'Resource',
    name: 'resource',
    type: 'options',
    noDataExpression: true,
    options: [
      {
        name: 'Prompt',
        value: 'prompt',
        description: 'Scan user prompts or LLM outputs for security threats',
      },
      {
        name: 'Tools',
        value: 'tools',
        description: 'Tool-permission checks, audit logging, integrity verification (local only)',
      },
      {
        name: 'Costs',
        value: 'costs',
        description: 'LLM cost tracking and budget enforcement (local only)',
      },
      {
        name: 'System',
        value: 'system',
        description: 'Device identity and system info (local only)',
      },
    ],
    default: 'prompt',
  },

  // -------------------- Operations: prompt --------------------
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {
      show: {
        resource: ['prompt'],
      },
    },
    options: [
      {
        name: 'Scan Prompt',
        value: 'scanPrompt',
        description: 'Analyze a user prompt for AI security threats before sending to LLM',
        action: 'Scan a prompt for AI security threats',
      },
      {
        name: 'Scan Output',
        value: 'scanOutput',
        description: 'Analyze an LLM response for PII, secrets, or leakage before returning to user',
        action: 'Scan an LLM output for leakage',
      },
    ],
    default: 'scanPrompt',
  },

  // -------------------- Operations: tools (local only) --------------------
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {
      show: {
        resource: ['tools'],
        transport: ['local'],
      },
    },
    options: [
      {
        name: 'Check Permission',
        value: 'checkPermission',
        description:
          'Ask the local SecureVector app whether a given tool call should be allowed. Intended for AI-agent workflows where tool choice is dynamic.',
        action: 'Check if a tool call is allowed',
      },
      {
        name: 'Log Call',
        value: 'logCall',
        description:
          'Append a row to the tamper-evident audit chain recording a tool-call decision (allow/block/log_only).',
        action: 'Log a tool call to the audit chain',
      },
      {
        name: 'Verify Chain',
        value: 'verifyChain',
        description:
          'Walk the hash-chained audit log and report integrity status. Schedule this in a nightly workflow.',
        action: 'Verify audit chain integrity',
      },
    ],
    default: 'checkPermission',
  },

  // -------------------- Operations: costs (local only) --------------------
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {
      show: {
        resource: ['costs'],
        transport: ['local'],
      },
    },
    options: [
      {
        name: 'Check Budget',
        value: 'checkBudget',
        description:
          'Return today\'s spend vs the configured budget for a given agent_id. Use in an IF node to short-circuit over-budget LLM calls.',
        action: 'Check today\'s spend against the configured budget',
      },
      {
        name: 'Track',
        value: 'track',
        description:
          'Record one LLM call\'s token usage so the app can compute cost. Place after every LLM node (OpenAI, LangChain Chat Model, or AI Agent).',
        action: 'Record token usage for an LLM call',
      },
    ],
    default: 'checkBudget',
  },

  // -------------------- Operations: system (local only) --------------------
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {
      show: {
        resource: ['system'],
        transport: ['local'],
      },
    },
    options: [
      {
        name: 'Get Device ID',
        value: 'getDeviceId',
        description: 'Return the stable per-machine SecureVector device_id. Useful for fleet attribution.',
        action: 'Get the device id',
      },
    ],
    default: 'getDeviceId',
  },
];

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

export const secureVectorFields: INodeProperties[] = [
  // -------------------- prompt.scanPrompt / scanOutput --------------------
  {
    displayName: 'Prompt to Scan',
    name: 'prompt',
    type: 'string',
    required: false,
    displayOptions: {
      show: {
        resource: ['prompt'],
        operation: ['scanPrompt', 'scanOutput'],
      },
    },
    default:
      '={{ $json.chatInput || $json.prompt || $json.message || $json.content || $json.text || $json.title || $json.input || $json.output }}',
    placeholder: 'Auto-detects: chatInput, prompt, message, content, text, title, input, output',
    description:
      'Text to analyze. For Scan Output, point this at an LLM response field. Auto-detects from input data or enter text directly.',
    typeOptions: {
      rows: 4,
    },
  },
  {
    displayName: 'Additional Fields',
    name: 'additionalFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['prompt'],
        operation: ['scanPrompt', 'scanOutput'],
      },
    },
    options: [
      {
        displayName: 'Timeout (Seconds)',
        name: 'timeout',
        type: 'number',
        default: 30,
        description: 'Maximum time to wait for scan results (1-300 seconds)',
        typeOptions: {
          minValue: 1,
          maxValue: 300,
        },
      },
      {
        displayName: 'Include Workflow Metadata',
        name: 'includeMetadata',
        type: 'boolean',
        default: false,
        description:
          'Whether to send workflow context (workflow ID, execution ID) with the scan request for tracking purposes',
      },
    ],
  },
  {
    displayName: 'Blocking Options',
    name: 'blockingOptions',
    type: 'collection',
    placeholder: 'Add Blocking Option',
    default: {},
    displayOptions: {
      show: {
        resource: ['prompt'],
        operation: ['scanPrompt', 'scanOutput'],
      },
    },
    options: [
      {
        displayName: 'Block on Threat',
        name: 'blockOnThreat',
        type: 'boolean',
        default: false,
        description:
          'Whether to stop the workflow if a security threat is detected. Enable for production security gates. Disable for monitoring mode.',
      },
      {
        displayName: 'Blocking Conditions',
        name: 'blockingConditions',
        type: 'multiOptions',
        options: [
          {
            name: 'API Verdict (BLOCK)',
            value: 'verdict',
            description: 'Block when SecureVector API returns BLOCK verdict',
          },
          {
            name: 'Threat Score Threshold',
            value: 'score',
            description: 'Block when threat score exceeds the configured threshold',
          },
          {
            name: 'Risk Level',
            value: 'riskLevel',
            description: 'Block when risk level matches the configured levels',
          },
        ],
        default: ['verdict'],
        description:
          'Choose which conditions trigger blocking. You can select multiple conditions. If any selected condition is met, the workflow will be blocked.',
      },
      {
        displayName: 'Threat Score Threshold',
        name: 'threatThreshold',
        type: 'number',
        default: 50,
        description:
          'Threat score threshold (0-100). If the scan score exceeds this value and "Block on Threat" is enabled, the workflow will stop. Default: 50.',
        typeOptions: {
          minValue: 0,
          maxValue: 100,
        },
      },
      {
        displayName: 'Block on Risk Levels',
        name: 'blockOnRiskLevels',
        type: 'multiOptions',
        options: [
          { name: 'Critical', value: 'critical', description: 'Block on critical threats' },
          { name: 'High', value: 'high', description: 'Block on high threats' },
          { name: 'Medium', value: 'medium', description: 'Block on medium threats' },
          { name: 'Low', value: 'low', description: 'Block on low threats' },
        ],
        default: ['critical', 'high'],
        description:
          'Block the workflow if the detected risk level matches any of these options.',
      },
    ],
  },

  // -------------------- tools.checkPermission --------------------
  {
    displayName: 'Tool ID',
    name: 'tool_id',
    type: 'string',
    required: true,
    default: '',
    placeholder: 'Gmail.send',
    description:
      'SecureVector tool_id to check (matches the tool list in the app\'s Tool Permissions UI).',
    displayOptions: {
      show: {
        resource: ['tools'],
        operation: ['checkPermission', 'logCall'],
        transport: ['local'],
      },
    },
  },
  {
    displayName: 'Function Name',
    name: 'function_name',
    type: 'string',
    default: '',
    placeholder: 'send',
    description: 'Optional function-level name for finer-grained attribution (free-form).',
    displayOptions: {
      show: {
        resource: ['tools'],
        operation: ['checkPermission', 'logCall'],
        transport: ['local'],
      },
    },
  },

  // -------------------- tools.logCall --------------------
  {
    displayName: 'Action',
    name: 'action',
    type: 'options',
    options: [
      { name: 'Allow', value: 'allow', description: 'Tool call proceeded' },
      { name: 'Block', value: 'block', description: 'Tool call was denied by policy' },
      { name: 'Log Only', value: 'log_only', description: 'Observed but not enforced' },
    ],
    default: 'allow',
    description: 'Decision to record in the audit chain.',
    displayOptions: {
      show: {
        resource: ['tools'],
        operation: ['logCall'],
        transport: ['local'],
      },
    },
  },
  {
    displayName: 'Reason',
    name: 'reason',
    type: 'string',
    default: '',
    description: 'Free-form reason for the decision (shown in the audit log).',
    displayOptions: {
      show: {
        resource: ['tools'],
        operation: ['logCall'],
        transport: ['local'],
      },
    },
  },
  {
    displayName: 'Risk',
    name: 'risk',
    type: 'options',
    options: [
      { name: 'Low', value: 'low' },
      { name: 'Medium', value: 'medium' },
      { name: 'High', value: 'high' },
      { name: 'Critical', value: 'critical' },
    ],
    default: 'low',
    description: 'Risk level for this tool call.',
    displayOptions: {
      show: {
        resource: ['tools'],
        operation: ['logCall'],
        transport: ['local'],
      },
    },
  },
  {
    displayName: 'Args Preview',
    name: 'args_preview',
    type: 'string',
    default: '',
    description:
      'Short preview of the tool call arguments for the audit log. Do not include secrets — this is stored in plaintext.',
    typeOptions: {
      rows: 2,
    },
    displayOptions: {
      show: {
        resource: ['tools'],
        operation: ['logCall'],
        transport: ['local'],
      },
    },
  },
  {
    displayName: 'Is Essential',
    name: 'is_essential',
    type: 'boolean',
    default: false,
    description:
      'Whether this tool is one of SecureVector\'s built-in essential tools (defaults to false for custom tools).',
    displayOptions: {
      show: {
        resource: ['tools'],
        operation: ['logCall'],
        transport: ['local'],
      },
    },
  },

  // -------------------- costs.checkBudget --------------------
  {
    displayName: 'Agent ID',
    name: 'agent_id',
    type: 'string',
    required: true,
    default: 'n8n-workflow',
    placeholder: 'content-bot',
    description:
      'Unique identifier for the agent whose budget to check. Matches the agent_id used in costs.track.',
    displayOptions: {
      show: {
        resource: ['costs'],
        operation: ['checkBudget', 'track'],
        transport: ['local'],
      },
    },
  },

  // -------------------- costs.track --------------------
  {
    displayName: 'Source',
    name: 'source',
    type: 'options',
    options: [
      {
        name: 'OpenAI Native Node',
        value: 'openai_native',
        description:
          'Pull tokens from $json.usage.* (n8n OpenAI node "Message a Model" with Simplify Output OFF).',
      },
      {
        name: 'LangChain Chat Model',
        value: 'langchain_chain',
        description:
          'Pull tokens from $json.response.generations[0][0].generationInfo.tokenUsage (LangChain Chat Model attached to a Basic LLM Chain, Simplify Output OFF).',
      },
      {
        name: 'AI Agent Execution',
        value: 'agent_execution',
        description:
          'Fallback for the AI Agent node, which does not expose tokens in $json. Call the n8n Get Execution API for the run\'s tokenUsage.',
      },
    ],
    default: 'openai_native',
    description: 'Where to read token counts from. Varies by upstream node type.',
    displayOptions: {
      show: {
        resource: ['costs'],
        operation: ['track'],
        transport: ['local'],
      },
    },
  },
  {
    displayName: 'Provider',
    name: 'provider',
    type: 'string',
    default: 'openai',
    description: 'Provider key (openai, anthropic, google, mistral, etc.) used for pricing lookup.',
    displayOptions: {
      show: {
        resource: ['costs'],
        operation: ['track'],
        transport: ['local'],
      },
    },
  },
  {
    displayName: 'Model ID',
    name: 'model_id',
    type: 'string',
    default: '={{ $json.model }}',
    description: 'Model name (e.g. gpt-4o, claude-sonnet-4-6). Used for pricing lookup.',
    displayOptions: {
      show: {
        resource: ['costs'],
        operation: ['track'],
        transport: ['local'],
      },
    },
  },
  {
    displayName: 'Input Tokens',
    name: 'input_tokens',
    type: 'number',
    default: '={{ $json.usage.prompt_tokens }}',
    description: 'Input / prompt tokens.',
    displayOptions: {
      show: {
        resource: ['costs'],
        operation: ['track'],
        transport: ['local'],
        source: ['openai_native'],
      },
    },
  },
  {
    displayName: 'Output Tokens',
    name: 'output_tokens',
    type: 'number',
    default: '={{ $json.usage.completion_tokens }}',
    description: 'Output / completion tokens.',
    displayOptions: {
      show: {
        resource: ['costs'],
        operation: ['track'],
        transport: ['local'],
        source: ['openai_native'],
      },
    },
  },
  {
    displayName: 'LangChain Response JSON',
    name: 'langchain_json',
    type: 'json',
    default: '={{ $json }}',
    description:
      'Pass the full $json blob from the LangChain Chat Model (Simplify Output OFF). The node will dig into response.generations[0][0].generationInfo.tokenUsage.',
    displayOptions: {
      show: {
        resource: ['costs'],
        operation: ['track'],
        transport: ['local'],
        source: ['langchain_chain'],
      },
    },
  },
  {
    displayName: 'Execution ID',
    name: 'executionId',
    type: 'string',
    default: '={{ $execution.id }}',
    description: 'The id of the current n8n execution. The node will call the Get Execution API to retrieve tokenUsage.',
    displayOptions: {
      show: {
        resource: ['costs'],
        operation: ['track'],
        transport: ['local'],
        source: ['agent_execution'],
      },
    },
  },
  {
    displayName: 'n8n Base URL',
    name: 'n8nBaseUrl',
    type: 'string',
    default: 'http://127.0.0.1:5678',
    description: 'URL of this n8n instance (used to fetch execution metadata).',
    displayOptions: {
      show: {
        resource: ['costs'],
        operation: ['track'],
        transport: ['local'],
        source: ['agent_execution'],
      },
    },
  },
  {
    displayName: 'n8n API Key',
    name: 'n8nApiKey',
    type: 'string',
    typeOptions: { password: true },
    default: '',
    description:
      'Optional — only needed if this n8n requires an API key for the Get Execution endpoint. Leave blank on unauthenticated self-hosted instances.',
    displayOptions: {
      show: {
        resource: ['costs'],
        operation: ['track'],
        transport: ['local'],
        source: ['agent_execution'],
      },
    },
  },
];
