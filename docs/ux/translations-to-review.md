# Traductions anglaises à relire

Ces textes n'existent qu'en français dans `data/reference/` (champs `definition_fr`, `licence`,
`full_name`, `citation`). Ils sont traduits côté client dans `frontend/src/i18n/dataStrings.ts` sans
toucher aux données ni à l'API. **Ce sont des traductions, donc du contenu : à relire avant publication.**

Un point de fond : la définition française de `inflation_yoy` se termine par « d'où l'absence de
higher_is_worse tranché », une note interne qui fuit dans une infobulle publique. La version anglaise
garde l'idée (« the relationship is not monotonic ») sans le nom de champ ; le français est inchangé.

## Définitions d'indicateurs (26)

- `gdp_real_pc` — Gross domestic product in volume (constant prices), per head of population. Measures average living standards independently of inflation and country size.
- `gdp_real` — Gross domestic product at constant prices (volume), which removes the effect of inflation to measure only the physical change in output.
- `gdp_nominal` — Gross domestic product valued at current-year prices (current currency), with no inflation correction. Serves as the common denominator of the ratios to GDP (debt, credit, investment, etc.), always in current currency and for the same year (§7.2).
- `unemployment_rate` — Share of the labour force without a job and actively looking for one, expressed as a percentage of the labour force.
- `population` — Total resident population of the country, used in particular to compute per-capita quantities (gdp_real_pc).
- `investment_gdp` — Gross fixed capital formation (productive and residential investment), as a share of nominal GDP of the same year.
- `consumption_gdp` — Final consumption as a share of nominal GDP of the same year. Neither a high nor a low level is intrinsically favourable: it depends on the counterpart (investment, external balance).
- `cpi` — Index measuring the change in the general level of prices of goods and services consumed by households, base 100 at a reference year.
- `inflation_yoy` — Percentage change in the consumer price index relative to the same period of the previous year. Neither very high inflation nor deflation is desirable: the relationship is not monotonic.
- `money_broad` — Broad monetary aggregate (demand deposits, savings and near-money included), reflecting the volume of money in circulation in the economy.
- `wages_nominal` — Index of nominal wages (not corrected for inflation), base 100 at a reference year.
- `rate_short` — Short-term nominal interest rate (typically interbank or 3-month Treasury bills), reflecting immediate monetary conditions.
- `rate_long` — Nominal yield on long-term government bonds (10-year proxy), reflecting inflation and long-term growth expectations.
- `policy_rate` — Reference interest rate set by the central bank to steer monetary conditions.
- `equity_index_nominal` — Total-return stock index (dividends reinvested), in nominal currency, base 100 at a reference year.
- `equity_capgain_index` — Price-only stock index (excluding dividend reinvestment), in nominal currency, base 100 at a reference year.
- `dividend_yield` — Dividends paid over twelve months as a percentage of the level of the equity index.
- `house_price_index` — Index of residential property prices, base 100 at a reference year.
- `exchange_rate_usd` — Exchange rate of the national currency against the US dollar, expressed in units of national currency per dollar.
- `debt_public_gdp` — Gross general-government debt, as a share of nominal GDP of the same year.
- `revenue_public_gdp` — Total general-government revenue, as a share of nominal GDP of the same year.
- `expenditure_public_gdp` — Total general-government expenditure, as a share of nominal GDP of the same year.
- `credit_private_gdp` — Outstanding bank credit to the non-financial private sector, as a share of nominal GDP of the same year. A high level and rapid growth are robust signals of financial risk in the literature (Schularick-Taylor).
- `mortgage_credit_gdp` — Outstanding mortgage credit (residential real-estate loans), as a share of nominal GDP of the same year.
- `bank_capital_ratio` — Capital ratio of the banking sector (capital relative to assets or to risk-weighted assets, depending on the source): a higher ratio indicates a better-capitalised banking system.
- `current_account_gdp` — Current-account balance of the balance of payments (goods, services, income, transfers), as a share of nominal GDP of the same year. Neither a large surplus nor a large deficit is intrinsically favourable: both can signal an imbalance.

## Sources (nom, citation, licence)

Seules les chaînes françaises sont traduites ; les titres d'ouvrages et noms propres sont inchangés.

### `jst`
- citation: Jordà, Ò., Schularick, M., Taylor, A. M. (2017). "Macrofinancial History and the New Business Cycle Facts." NBER Macroeconomics Annual 2016, vol. 31, 213-263. Release 6 (2022), 18 advanced economies since 1870.
- licence: Non-commercial use, attribution required, share-alike (CC BY-NC-SA).
### `maddison`
- licence: Free reuse with attribution (CC BY 4.0).
### `bis_cbpol`
- licence: Reuse with attribution, BIS Data Portal terms.
### `bis_credit`
- licence: Reuse with attribution, BIS Data Portal terms.
### `bis_pp`
- licence: Reuse with attribution, BIS Data Portal terms.
### `imf_ifs`
- licence: Reuse with attribution, IMF Data terms.
### `imf_weo`
- licence: Reuse with attribution, IMF Data terms.
### `imf_ghd`
- citation: International Monetary Fund, Global Debt Database; Abbas, S. M. A. et al. (2010), "A Historical Public Debt Database", IMF Working Paper 10/245.
- licence: Reuse with attribution, IMF Data terms.
### `oecd_mei`
- licence: Reuse with attribution, OECD Data terms.
### `eurostat`
- citation: Eurostat, European statistical database.
- licence: Reuse with attribution, Eurostat licence policy.
### `riksbank_hms`
- licence: Central bank publication, reuse with attribution.
### `norges_hms`
- licence: Central bank publication, reuse with attribution.
### `boe_millennium`
- licence: Central bank publication, reuse with attribution.
### `owid`
- licence: Free reuse with attribution (CC BY 4.0).
### `rr_crises`
- full_name: Reinhart & Rogoff — crisis chronology
- citation: Reinhart, C. M. and Rogoff, K. S. (2009). This Time Is Different: Eight Centuries of Financial Folly. Associated data.
- licence: Academic research data, reuse with attribution.
### `events_manual`
- full_name: Repository YAML files — manually curated events
- citation: Internal MacroLens curation from widely established historical facts (wars, monetary regimes, oil shocks). Each individual event carries its own verified source_url — see data/events/*.yaml. Never serves as a source for a numeric value in `observations` (rule 2, CLAUDE.md).
- licence: N/A — internal curation, no third-party data redistributed.
