import {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { secureVectorOperations, secureVectorFields } from './descriptions/SecureVectorDescription';
import { scanPrompt } from './GenericFunctions';

export class SecureVector implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'SecureVector',
    name: 'secureVector',
    icon: 'file:securevector.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'AI security scanning for prompt injection, PII exposure, and malicious content',
    defaults: {
      name: 'SecureVector',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'secureVectorApi',
        required: true,
      },
    ],
    properties: [...secureVectorOperations, ...secureVectorFields],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const operation = this.getNodeParameter('operation', 0) as string;

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      try {
        if (operation === 'scanPrompt') {
          const scanResult = await scanPrompt.call(this, itemIndex);

          returnData.push({
            json: scanResult as unknown as IDataObject,
            pairedItem: { item: itemIndex },
          });
        }
      } catch (error: unknown) {
        const err = error as Error;
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              error: err.message,
            },
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
