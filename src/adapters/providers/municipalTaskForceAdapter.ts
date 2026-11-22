import { BaseGrantAdapter, GrantSubmissionResponse } from '../baseGrantAdapter';
import { GrantProviderId } from '../../types/domain';
export class MunicipalTaskForceAdapter extends BaseGrantAdapter {
  readonly providerId: GrantProviderId = 'municipal_taskforce'; readonly displayName = 'Terre Haute Municipal Task Force';
  protected async sendToProviderEndpoint(id: string, payload: Record<string, unknown>): Promise<GrantSubmissionResponse> { void payload; return { status: 'APPROVED', externalRefId: `MUN-${id.slice(0, 8)}`, awardedAmount: 5000 }; }
}
