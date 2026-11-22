import { BaseGrantAdapter, GrantSubmissionResponse } from '../baseGrantAdapter';
import { GrantProviderId } from '../../types/domain';
export class CommunityFoundationAdapter extends BaseGrantAdapter {
  readonly providerId: GrantProviderId = 'community_foundation'; readonly displayName = 'Community Foundation Network';
  protected async sendToProviderEndpoint(id: string, payload: Record<string, unknown>): Promise<GrantSubmissionResponse> { void payload; return { status: 'PENDING_VERIFICATION', externalRefId: `FOUND-${id.slice(0, 8)}`, awardedAmount: 15000 }; }
}
