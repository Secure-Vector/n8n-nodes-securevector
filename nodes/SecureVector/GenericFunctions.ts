import {
  IExecuteFunctions,
  IHttpRequestOptions,
  JsonObject,
  NodeApiError,
  NodeOperationError,
} from 'n8n-workflow';
import { ScanRequestSchema, ScanResponseSchema } from './schemas';
import { ScanRequest, ScanResponse } from './types';

export async function scanPrompt(
  this: IExecuteFunctions,
  itemIndex: number,
): Promise<ScanResponse> {
  const prompt = this.getNodeParameter('prompt', itemIndex) as string;
  const timeout = this.getNodeParameter('timeout', itemIndex, 30) as number;
  const includeMetadata = this.getNodeParameter('includeMetadata', itemIndex, false) as boolean;
  const blockOnThreat = this.getNodeParameter('blockOnThreat', itemIndex, false) as boolean;
  const threatThreshold = this.getNodeParameter('threatThreshold', itemIndex, 50) as number;
  const blockOnRiskLevels = this.getNodeParameter(
    'blockOnRiskLevels',
    itemIndex,
    ['critical', 'high'],
  ) as string[];

  const credentials = await this.getCredentials('secureVectorApi');
  const baseUrl = (credentials.baseUrl as string) || 'https://scan.securevector.io';

  const scanRequest: ScanRequest = {
    prompt,
    timeout,
  };

  if (includeMetadata) {
    const workflowId = this.getWorkflow().id;
    const executionId = this.getExecutionId();

    scanRequest.metadata = {
      workflowId: workflowId || undefined,
      executionId: executionId || undefined,
      source: 'n8n-workflow',
    };
  }

  try {
    const validatedRequest = ScanRequestSchema.parse(scanRequest);

    const options: IHttpRequestOptions = {
      method: 'POST',
      url: `${baseUrl}/analyze`,
      body: validatedRequest,
      json: true,
      timeout: timeout * 1000,
    };

    const response = await this.helpers.httpRequestWithAuthentication.call(
      this,
      'secureVectorApi',
      options,
    );

    const validatedResponse = ScanResponseSchema.parse(response);

    // Check if blocking mode is enabled and threat exceeds threshold
    if (blockOnThreat) {
      const scoreExceedsThreshold = validatedResponse.score > threatThreshold;
      const riskLevelMatches = blockOnRiskLevels.includes(validatedResponse.riskLevel);

      if (scoreExceedsThreshold || riskLevelMatches) {
        const threatSummary = validatedResponse.threats
          .map((t) => `${t.category} (${t.severity})`)
          .join(', ');

        throw new NodeOperationError(
          this.getNode(),
          `Security threat detected: ${validatedResponse.riskLevel} risk (score: ${validatedResponse.score})`,
          {
            itemIndex,
            description: `The prompt was flagged as ${validatedResponse.riskLevel} risk with ${validatedResponse.threats.length} threat(s): ${threatSummary}. Workflow blocked by security policy. Scan ID: ${validatedResponse.scanId}`,
          },
        );
      }
    }

    return validatedResponse;
  } catch (error: unknown) {
    const err = error as Error & { code?: string };

    if (err.name === 'ZodError') {
      throw new NodeOperationError(this.getNode(), `Invalid data: ${err.message}`, {
        itemIndex,
        description: 'The request or response data format is invalid',
      });
    }

    if (err.name === 'AbortError' || err.code === 'ETIMEDOUT') {
      throw new NodeApiError(this.getNode(), error as JsonObject, {
        message: 'Scan timeout',
        description: `Scan did not complete within ${timeout} seconds`,
        itemIndex,
      });
    }

    throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
  }
}
