import { INodeProperties } from 'n8n-workflow';

export const secureVectorOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    options: [
      {
        name: 'Scan Prompt',
        value: 'scanPrompt',
        description: 'Analyze a prompt for security threats',
        action: 'Scan a prompt for security threats',
      },
    ],
    default: 'scanPrompt',
  },
];

export const secureVectorFields: INodeProperties[] = [
  {
    displayName: 'Prompt',
    name: 'prompt',
    type: 'string',
    required: true,
    displayOptions: {
      show: {
        operation: ['scanPrompt'],
      },
    },
    default: '',
    placeholder: 'Enter the prompt to scan for security threats...',
    description: 'The text prompt to analyze for security vulnerabilities',
    typeOptions: {
      rows: 4,
    },
  },
  {
    displayName: 'Timeout (seconds)',
    name: 'timeout',
    type: 'number',
    required: false,
    displayOptions: {
      show: {
        operation: ['scanPrompt'],
      },
    },
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
    required: false,
    displayOptions: {
      show: {
        operation: ['scanPrompt'],
      },
    },
    default: false,
    description:
      'Whether to send workflow context (workflow ID, execution ID) with the scan request for tracking purposes',
  },
  {
    displayName: 'Block on Threat',
    name: 'blockOnThreat',
    type: 'boolean',
    required: false,
    displayOptions: {
      show: {
        operation: ['scanPrompt'],
      },
    },
    default: false,
    description:
      'Whether to stop the workflow if a threat is detected above the threshold. When enabled, high-threat prompts will cause the node to fail (blocking mode). When disabled, the node always returns scan results for analysis (non-blocking mode).',
  },
  {
    displayName: 'Threat Score Threshold',
    name: 'threatThreshold',
    type: 'number',
    required: false,
    displayOptions: {
      show: {
        operation: ['scanPrompt'],
        blockOnThreat: [true],
      },
    },
    default: 50,
    description:
      'Threat score threshold (0-100). If the scan score exceeds this value and "Block on Threat" is enabled, the workflow will stop. Default: 50 (blocks on medium-high threats)',
    typeOptions: {
      minValue: 0,
      maxValue: 100,
    },
  },
  {
    displayName: 'Block on Risk Levels',
    name: 'blockOnRiskLevels',
    type: 'multiOptions',
    required: false,
    displayOptions: {
      show: {
        operation: ['scanPrompt'],
        blockOnThreat: [true],
      },
    },
    options: [
      {
        name: 'Critical',
        value: 'critical',
        description: 'Block on critical threats',
      },
      {
        name: 'High',
        value: 'high',
        description: 'Block on high threats',
      },
      {
        name: 'Medium',
        value: 'medium',
        description: 'Block on medium threats',
      },
      {
        name: 'Low',
        value: 'low',
        description: 'Block on low threats',
      },
    ],
    default: ['critical', 'high'],
    description:
      'Block the workflow if the detected risk level matches any of these options. Default: Critical and High threats will block the workflow.',
  },
];
