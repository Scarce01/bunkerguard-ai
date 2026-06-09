import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface BlockchainRecord {
  sessionId: string;
  bdnHash: string;
  mfmHash: string;
  validationHash: string;
  transactionHash: string;
  blockNumber: number;
  timestamp: string;
}

export interface BlockchainRecordsData {
  records: BlockchainRecord[];
  loading: boolean;
  error: string | null;
}

/** Returns every session that has been anchored on-chain (blockchain_tx is not
 *  null). Pulls the SHA-256 hashes from the joined tables so the page shows the
 *  full evidence chain — BDN hash from bdn_records.ebdn_qr_sha256, MFM hash
 *  from the last packet's packet_sha256, validation hash from sessions.evidence_sha256. */
export function useBlockchainRecords(): BlockchainRecordsData {
  const [data, setData] = useState<BlockchainRecordsData>({ records: [], loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setData((d) => ({ ...d, loading: true, error: null }));

    async function load() {
      try {
        const { data: sessions, error: sErr } = await supabase
          .from('sessions')
          .select('session_id, blockchain_tx, evidence_sha256, created_at, updated_at')
          .not('blockchain_tx', 'is', null)
          .order('created_at', { ascending: false });
        if (sErr) throw sErr;
        const sessionRows = (sessions ?? []) as any[];

        // Pull supporting hashes in parallel
        const ids = sessionRows.map((s) => s.session_id);
        const [bdnRes, mfmRes] = ids.length === 0
          ? [{ data: [] as any[], error: null }, { data: [] as any[], error: null }]
          : await Promise.all([
              supabase.from('bdn_records')
                .select('session_id, ebdn_qr_sha256')
                .in('session_id', ids),
              supabase.from('mfm_stream')
                .select('session_id, packet_sha256, seq_no')
                .in('session_id', ids)
                .order('seq_no', { ascending: false }),
            ]);
        if (bdnRes.error) throw bdnRes.error;
        if (mfmRes.error) throw mfmRes.error;

        const bdnHashBySession = new Map<string, string>();
        ((bdnRes.data ?? []) as any[]).forEach((r) => bdnHashBySession.set(r.session_id, r.ebdn_qr_sha256));
        const mfmHashBySession = new Map<string, string>();
        ((mfmRes.data ?? []) as any[]).forEach((r) => {
          if (!mfmHashBySession.has(r.session_id)) mfmHashBySession.set(r.session_id, r.packet_sha256);
        });

        const records: BlockchainRecord[] = sessionRows.map((s) => ({
          sessionId: s.session_id,
          bdnHash:        bdnHashBySession.get(s.session_id) ?? '0x0000000000000000',
          mfmHash:        mfmHashBySession.get(s.session_id) ?? '0x0000000000000000',
          validationHash: s.evidence_sha256 ?? '0x0000000000000000',
          transactionHash: s.blockchain_tx,
          blockNumber: 0,
          timestamp: s.updated_at ?? s.created_at,
        }));

        if (!cancelled) setData({ records, loading: false, error: null });
      } catch (e: any) {
        if (!cancelled) setData((d) => ({ ...d, loading: false, error: e?.message ?? String(e) }));
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return data;
}
