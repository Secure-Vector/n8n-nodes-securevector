import {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeConnectionTypes,
  NodeOperationError,
} from 'n8n-workflow';
import { secureVectorOperations, secureVectorFields } from './descriptions/SecureVectorDescription';
import {
  scanPrompt,
  scanOutput,
  checkToolPermission,
  logToolCall,
  verifyAuditChain,
  trackCost,
  checkBudgetStatus,
  getDeviceId,
} from './GenericFunctions';

// Operations that only make sense against the local SecureVector app.
// Even though the descriptions hide these in the UI when transport=cloud,
// a hand-crafted workflow JSON could still set operation=<local-only> with
// transport=cloud — the runtime guard below turns that into a clean error
// instead of a confusing 404/auth failure against scan.securevector.io.
const LOCAL_ONLY_OPS = new Set<string>([
  'checkPermission',
  'logCall',
  'verifyChain',
  'checkBudget',
  'track',
  'getDeviceId',
]);

export class SecureVector implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'SecureVector',
    name: 'secureVector',
    icon: 'file:securevector.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
    description:
      'AI security: scan prompts and LLM outputs, gate tool calls, track LLM cost and budget. Cloud by default; Local App transport unlocks tool audit, costs, and device ID.',
    defaults: {
      name: 'SecureVector',
    },
    usableAsTool: true,
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [
      {
        name: 'secureVectorApi',
        // Required only when transport=cloud. Local transport needs no creds —
        // the app is unauthenticated on loopback by design.
        required: true,
        displayOptions: {
          show: {
            transport: ['cloud'],
          },
        },
      },
    ],
    properties: [...secureVectorOperations, ...secureVectorFields],
  };

  // eslint-disable-next-line complexity
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const transport = (this.getNodeParameter('transport', 0, 'cloud') as string) || 'cloud';
    const resource = this.getNodeParameter('resource', 0);
    const operation = String(this.getNodeParameter('operation', 0));

    // Defensive: local-only operation invoked while transport=cloud.
    if (transport !== 'local' && LOCAL_ONLY_OPS.has(operation)) {
      throw new NodeOperationError(
        this.getNode(),
        `Operation "${operation}" requires Transport=Local App.`,
        {
          description:
            'The cloud API does not expose this endpoint. Switch Transport to "Local App" on the node, or remove this operation from the workflow.',
        },
      );
    }

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      try {
        let result: unknown;

        if (resource === 'prompt' && operation === 'scanPrompt') {
          result = await scanPrompt.call(this, itemIndex);
        } else if (resource === 'prompt' && operation === 'scanOutput') {
          result = await scanOutput.call(this, itemIndex);
        } else if (resource === 'tools' && operation === 'checkPermission') {
          result = await checkToolPermission.call(this, itemIndex);
        } else if (resource === 'tools' && operation === 'logCall') {
          result = await logToolCall.call(this, itemIndex);
        } else if (resource === 'tools' && operation === 'verifyChain') {
          result = await verifyAuditChain.call(this, itemIndex);
        } else if (resource === 'costs' && operation === 'checkBudget') {
          result = await checkBudgetStatus.call(this, itemIndex);
        } else if (resource === 'costs' && operation === 'track') {
          result = await trackCost.call(this, itemIndex);
        } else if (resource === 'system' && operation === 'getDeviceId') {
          result = await getDeviceId.call(this, itemIndex);
        } else {
          throw new NodeOperationError(
            this.getNode(),
            `Unsupported resource.operation: ${resource}.${operation}`,
            { itemIndex },
          );
        }

        returnData.push({
          json: result as IDataObject,
          pairedItem: { item: itemIndex },
        });
      } catch (error: unknown) {
        const err = error as Error;
        if (this.continueOnFail()) {
          returnData.push({
            json: { error: err.message },
            pairedItem: { item: itemIndex },
          });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }
}
