import type { ProviderId } from '../shared/types';
import type { ExtractorConfig, Provider } from './types';
import { createClaudeProvider } from './claude';
import { createChatGptProvider } from './chatgpt';

export const PROVIDER_IDS: ProviderId[] = ['claude', 'chatgpt'];

export function createProviders(cfg: ExtractorConfig): Record<ProviderId, Provider> {
  return {
    claude: createClaudeProvider(cfg.claude),
    chatgpt: createChatGptProvider(cfg.chatgpt),
  };
}

export const PROVIDER_META: Record<ProviderId, { name: string; short: string; partition: string }> = {
  claude: { name: 'Claude', short: 'C', partition: 'persist:claude' },
  chatgpt: { name: 'ChatGPT', short: 'G', partition: 'persist:chatgpt' },
};
