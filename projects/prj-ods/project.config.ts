import { defineProject } from '../../src/types';

/**
 * Shared configuration for the project.
 * Values ending in "Env" are NAMES of environment variables;
 * the values themselves live in env/.env.<environment>.
 */
export default defineProject({
  defaults: {
    v1: {
      urlEnv: 'ODS_CREW_V1_URL',
      auth: {
        type: 'apiKey',
        header: 'Ocp-Apim-Subscription-Key',
        keyEnv: 'APIM_SUBSCRIPTION_KEY_V1',
      },
    },

    v2: {
      urlEnv: 'ODS_CREW_V2_URL',
      auth: {
        type: 'apiKey',
        header: 'Ocp-Apim-Subscription-Key',
        keyEnv: 'APIM_SUBSCRIPTION_KEY_V2',
      },
    },
  },

  rules: {
    ignore: ['**.traceId', '**.correlationId'],
  },
});
