import type { EvidenceReport } from './types';
import { getSessionById } from './mockSessions';

export const mockEvidenceReports: EvidenceReport[] = [
  {
    id: 'ER-2026-016',
    sessionId: '2026-016',
    generatedAt: new Date(Date.now() - 25 * 60000).toISOString(),
    session: getSessionById('2026-016')!,
    aiAnalysis: {
      summary: 'A02 Quantity Final Mismatch detected. MFM recorded 481.2 MT, while BDN declares 500.0 MT. Systematic underfueling pattern confirmed.',
      concerns: [
        'MFM final reading is 18.8 MT lower than declared BDN quantity (3.76% deviation)',
        'Deviation exceeds MPA tolerance threshold of 2.0%',
        'BunkerGuard Demo Supplier Gamma Pte Ltd flagged in 9 of 22 recent sessions',
        'Systematic pattern confirmed across SES-2026-012, 016, 019, 021',
        'MPA notification issued on 2026-06-10',
      ],
      recommendation: 'REFUSE TO SIGN BDN',
      confidence: 94,
    },
    lopDraft: `LETTER OF PROTEST

To: BunkerGuard Demo Supplier Gamma Pte Ltd
Date: 10 June 2026
Re: Bunkering Session SES-2026-016 - MAERSK HONAM

Dear Sir/Madam,

We hereby formally protest the bunker delivery made on 10 June 2026 at Singapore, Eastern Anchorage.

VESSEL DETAILS:
- Vessel Name: MAERSK HONAM
- IMO Number: 9650888
- Bunkering Date: 10 June 2026
- Location: Singapore, Eastern Anchorage

SUPPLIER DETAILS:
- Supplier: BunkerGuard Demo Supplier Gamma Pte Ltd
- Licence: MPA-BKR-2024-0092
- Barge: MT FUEL STAR 7
- Product: VLSFO RMG 380

QUANTITY DISCREPANCY:
- BDN Declared Quantity: 500.0 MT
- Mass Flow Meter Delivered Quantity: 481.2 MT
- Shortfall: 18.8 MT (3.76%)

EVIDENCE:
The vessel's calibrated Mass Flow Meter (MFM) continuously recorded fuel delivery throughout the bunkering operation. The final MFM reading shows 481.2 MT delivered, while the Bunker Delivery Note (BDN) declares 500.0 MT.

This discrepancy of 18.8 MT (3.76%) significantly exceeds the MPA-mandated tolerance threshold of 2.0% and represents an estimated financial loss of USD $16,271.

BunkerGuard AI has identified a systematic underfueling pattern from this supplier across multiple sessions (SES-2026-012, 016, 019, 021) with a total exposure of USD $32,405.

REGULATORY ESCALATION:
- MPA notification issued on 2026-06-10
- Anomaly Rule A02 triggered
- Blockchain verification: Block #186543219

ACTIONS REQUIRED:
1. Immediate independent quantity verification
2. Credit note for short-delivered quantity
3. Explanation for systematic pattern
4. MPA investigation and corrective measures

We refuse to countersign the BDN and reserve all rights with respect to this matter.

Regards,
Chief Engineer
MAERSK HONAM`,
  },
];

export const getEvidenceReportBySessionId = (sessionId: string) =>
  mockEvidenceReports.find(r => r.sessionId === sessionId);
