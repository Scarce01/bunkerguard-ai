from ingest import load_sessions
for s in load_sessions():
    dev = f"{s.deviation_pct:+6.2f}%" if s.deviation_pct is not None else "  --   "
    flag = str(s.in_flight)
    print(f"  {s.session_id}  inflight={flag:<5}  dev={dev}  mfm={len(s.mfm_stream):>3}  ebdn={s.bdn.ebdn_status.value:<18} sup_flag={s.supplier.flag}")
