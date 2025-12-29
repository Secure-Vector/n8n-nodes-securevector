import {
  IExecuteFunctions,
  IHttpRequestOptions,
  JsonObject,
  NodeApiError,
  NodeOperationError,
} from 'n8n-workflow';
import { ScanRequestSchema, ActualScanResponseSchema } from './schemas';
import { ScanRequest, ScanResponse } from './types';

export async function scanPrompt(
  this: IExecuteFunctions,
  itemIndex: number,
): Promise<ScanResponse> {
  const prompt = this.getNodeParameter('prompt', itemIndex, '') as string;

  // Validate that we have a prompt to scan
  if (!prompt || prompt.trim() === '') {
    throw new NodeOperationError(
      this.getNode(),
      'Prompt is required but was empty or undefined',
      {
        itemIndex,
        description: 'Please provide a prompt to scan. You can use expressions like {{ $json.prompt }} to get data from previous nodes, or enter text directly.',
      },
    );
  }

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

    // Validate and transform the actual API response
    const apiResponse = ActualScanResponseSchema.parse(response);

    // Transform to normalized format for n8n
    const normalizedResponse = {
      verdict: apiResponse.verdict,
      score: apiResponse.threat_score * 100, // Convert 0-1 to 0-100
      threat_score: apiResponse.threat_score,
      riskLevel: apiResponse.threat_level,
      threat_level: apiResponse.threat_level,
      confidence_score: apiResponse.confidence_score,
      threats: apiResponse.matched_rules.map((rule) => ({
        rule_id: rule.rule_id,
        rule_name: rule.rule_name,
        category: rule.category,
        severity: rule.severity,
        confidence: rule.confidence,
      })),
      recommendation: apiResponse.recommendation,
      analysis: apiResponse.analysis,
    };

    // Check if blocking mode is enabled and threat exceeds threshold
    if (blockOnThreat) {
      const scoreExceedsThreshold = normalizedResponse.score > threatThreshold;
      const riskLevelMatches = blockOnRiskLevels.includes(normalizedResponse.riskLevel);

      if (scoreExceedsThreshold || riskLevelMatches || apiResponse.verdict === 'BLOCK') {
        const threatSummary = normalizedResponse.threats
          .map((t) => `${t.category} (${t.severity})`)
          .join(', ');

        throw new NodeOperationError(
          this.getNode(),
          `Security threat detected: ${normalizedResponse.riskLevel} risk (score: ${normalizedResponse.score.toFixed(1)})`,
          {
            itemIndex,
            description: `${apiResponse.recommendation}. The prompt was flagged as ${normalizedResponse.riskLevel} risk with ${normalizedResponse.threats.length} threat(s): ${threatSummary}. Workflow blocked by security policy.`,
          },
        );
      }
    }

    return normalizedResponse as ScanResponse;
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
