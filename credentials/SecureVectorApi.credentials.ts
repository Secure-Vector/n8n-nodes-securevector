import {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class SecureVectorApi implements ICredentialType {
  name = 'secureVectorApi';

  displayName = 'SecureVector API';

  documentationUrl = 'https://docs.securevector.io';

  properties: INodeProperties[] = [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      placeholder: 'sv_your_api_key_here',
      description: 'SecureVector API key (starts with sv_). Get yours at securevector.io. By using this node, you consent to transmitting and storing input data with SecureVector for analysis and your auditing purposes. See DISCLAIMER.md for details.',
    },
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'https://scan.securevector.io',
      required: false,
      description: 'API base URL (default: https://scan.securevector.io). Override for testing.',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        'X-Api-Key': '={{$credentials.apiKey}}',
      },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.baseUrl || "https://scan.securevector.io"}}',
      url: '/auth/verify',
      method: 'GET',
    },
  };
}
