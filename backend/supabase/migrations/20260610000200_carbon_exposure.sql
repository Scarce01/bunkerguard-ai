-- Carbon exposure is supplementary intelligence and never changes fraud risk.
alter table sessions add column if not exists total_fuel_mt numeric;
alter table sessions add column if not exists emission_factor_tco2e_per_mt numeric;
alter table sessions add column if not exists estimated_carbon_tco2e numeric;
alter table sessions add column if not exists financial_exposure_usd numeric default 0;
alter table sessions add column if not exists carbon_risk_level text;

alter table suppliers add column if not exists supplier_name text;
alter table suppliers add column if not exists fuel_grade text;
alter table suppliers add column if not exists total_fuel_mt numeric default 0;
alter table suppliers add column if not exists emission_factor_tco2e_per_mt numeric;
alter table suppliers add column if not exists estimated_carbon_tco2e numeric default 0;
alter table suppliers add column if not exists financial_exposure_usd numeric default 0;
alter table suppliers add column if not exists risk_score numeric default 0;
alter table suppliers add column if not exists flagged_sessions integer default 0;
alter table suppliers add column if not exists carbon_risk_level text default 'LOW';

update sessions s
set total_fuel_mt = coalesce(nullif(s.mfm_qty_mt, 0), s.bdn_qty_mt, 0),
    emission_factor_tco2e_per_mt = case
      when upper(coalesce(s.fuel_grade, '')) like '%BIO%' then 2.100
      when upper(coalesce(s.fuel_grade, '')) like '%LNG%' then 2.750
      when upper(coalesce(s.fuel_grade, '')) like '%MGO%' or upper(coalesce(s.fuel_grade, '')) in ('DMA', 'DMZ') then 3.206
      else 3.114
    end;

update sessions s
set estimated_carbon_tco2e = round(s.total_fuel_mt * s.emission_factor_tco2e_per_mt, 3),
    financial_exposure_usd = coalesce((
      select r.estimated_impact_usd from risk_scores r where r.session_id = s.session_id
    ), s.financial_exposure_usd, 0);

update sessions
set carbon_risk_level = case
  when estimated_carbon_tco2e >= 10000 then 'CRITICAL'
  when estimated_carbon_tco2e >= 5000 then 'HIGH'
  when estimated_carbon_tco2e >= 2500 then 'MODERATE'
  else 'LOW'
end;

with supplier_totals as (
  select supplier_id,
         max(supplier_name) as supplier_name,
         max(fuel_grade) as fuel_grade,
         sum(total_fuel_mt) as total_fuel_mt,
         sum(estimated_carbon_tco2e) as estimated_carbon_tco2e,
         sum(financial_exposure_usd) as financial_exposure_usd,
         max(coalesce(risk_score, 0)) as risk_score,
         count(*) filter (where coalesce(risk_score, 0) >= 46 or risk_category in ('HIGH', 'CRITICAL')) as flagged_sessions
  from sessions
  where supplier_id is not null
  group by supplier_id
)
update suppliers p
set supplier_name = coalesce(t.supplier_name, p.name),
    fuel_grade = t.fuel_grade,
    total_fuel_mt = coalesce(t.total_fuel_mt, 0),
    estimated_carbon_tco2e = coalesce(t.estimated_carbon_tco2e, 0),
    emission_factor_tco2e_per_mt = case when coalesce(t.total_fuel_mt, 0) > 0
      then round(t.estimated_carbon_tco2e / t.total_fuel_mt, 3) else 3.114 end,
    financial_exposure_usd = coalesce(t.financial_exposure_usd, 0),
    risk_score = coalesce(t.risk_score, 0),
    flagged_sessions = coalesce(t.flagged_sessions, 0),
    carbon_risk_level = case
      when coalesce(t.estimated_carbon_tco2e, 0) >= 10000 then 'CRITICAL'
      when coalesce(t.estimated_carbon_tco2e, 0) >= 5000 then 'HIGH'
      when coalesce(t.estimated_carbon_tco2e, 0) >= 2500 then 'MODERATE'
      else 'LOW'
    end
from supplier_totals t
where p.id = t.supplier_id;
