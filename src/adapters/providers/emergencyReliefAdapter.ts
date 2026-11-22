import { BaseGrantAdapter, GrantSubmissionResponse } from '../baseGrantAdapter';
import { GrantProviderId } from '../../types/domain';
export class EmergencyReliefAdapter extends BaseGrantAdapter {
  readonly providerId: GrantProviderId = 'emergency_relief'; readonly displayName = 'Emergency Crisis Response Portal';
  protected async sendToProviderEndpoint(id: string, payload: Record<string, unknown>): Promise<GrantSubmissionResponse> { void payload; return { status: 'APPROVED', externalRefId: `EMERG-${id.slice(0, 8)}`, awardedAmount: 3000 }; }
}
