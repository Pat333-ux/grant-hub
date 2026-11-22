import { BaseGrantAdapter, GrantSubmissionResponse } from '../baseGrantAdapter';
import { GrantProviderId } from '../../types/domain';
export class FederalGrantAdapter extends BaseGrantAdapter {
  readonly providerId: GrantProviderId = 'federal_grants'; readonly displayName = 'Federal Grants Portal API';
  protected async sendToProviderEndpoint(id: string, payload: Record<string, unknown>): Promise<GrantSubmissionResponse> { void payload; return { status: 'APPROVED', externalRefId: `FED-GRANT-${id.slice(0, 8)}`, awardedAmount: 10000 }; }
}
