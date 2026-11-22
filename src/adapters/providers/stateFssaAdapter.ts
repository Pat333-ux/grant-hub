import { BaseGrantAdapter, GrantSubmissionResponse } from '../baseGrantAdapter';
import { GrantProviderId } from '../../types/domain';
export class StateFssaAdapter extends BaseGrantAdapter {
  readonly providerId: GrantProviderId = 'state_fssa'; readonly displayName = 'State FSSA Program Gateway';
  protected async sendToProviderEndpoint(id: string, payload: Record<string, unknown>): Promise<GrantSubmissionResponse> { void payload; return { status: 'PENDING_VERIFICATION', externalRefId: `FSSA-${id.slice(0, 8)}`, awardedAmount: 7500 }; }
}
