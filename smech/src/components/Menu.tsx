import FieldManual from './FieldManual';
import { useMemo, useState } from 'react';
import type { ControlMode, VehicleType } from '../game/types';
import { VEHICLE_ORDER, VEHICLES, WEAPON_INFO } from '../game/vehicles';
import { buildConfig, frameOf, reserveRecharge } from '../game/forge';
import { RACK_CAPACITIES } from '../game/ordnance';
import { getAllMechs, selectMech, sellCustomMech, type GarageState } from '../game/garage';
import { randomSeedCode } from '../game/rng';
import { generateLayout } from '../game/layout';
import { conditionFor } from '../game/sectorRules';
import { DOSSIERS } from '../game/threats';
import type { Settings } from '../game/settings';
import type { RunRecord } from '../game/records';
import hero from '../assets/warden-ruins.jpg';
import warden from '../assets/mech.jpg';
import pyre from '../assets/cinder.jpg';
import glacier from '../assets/phantom.jpg';
import { Icon } from './Icons';
import SettingsPanel from './SettingsPanel';
import MechBuilder from './MechBuilder';
import FullscreenButton from './FullscreenButton';
import './console.css';

interface Props {
  onStart: (vehicle: VehicleType, controls: ControlMode, seed: string) => void;
  settings: Settings;
  onSettings: (settings: Settings) => void;
  records: RunRecord[];
  garage: GarageState;
  onGarage: (garage: GarageState) => void;
}
const photos = { warden, pyre, glacier };
const roles = { warden: 'Assault', pyre: 'Brawler', glacier: 'Precision' };
const desc = {
  warden: 'A versatile frontline chassis built to hold ground and control the middle distance.',
  pyre: 'A close-range bruiser built to break formations and turn bottlenecks into kill zones.',
  glacier: 'A precision duelist built to freeze advancing targets and control long sightlines.',
};
const tabs = ['Hangar', 'Enemy intel', 'Field manual', 'Combat log'] as const;
type Page = (typeof tabs)[number] | 'Settings';
const pad = (n: number) => String(n).padStart(2, '0');
function Crest() {
  return (
    <svg viewBox="0 0 44 40" width="43" height="40" fill="currentColor" aria-hidden="true">
      <path d="M1 4h9l11 12v9L1 10zm42 0h-9L23 16v9l20-15zM4 16l17 14v8L4 24zm36 0L23 30v8l17-14zM15 3h14l-7 9z" />
    </svg>
  );
}
function Section({ n, children, aside }: { n: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="op-heading">
      <small>{n}</small>
      <h2>{children}</h2>
      <i />
      {aside}
    </div>
  );
}

export default function Menu({ onStart, settings, onSettings, records, garage, onGarage }: Props) {
  const [page, setPage] = useState<Page>('Hangar');
  const [building, setBuilding] = useState(false);
  const [controls, setControls] = useState<ControlMode>('arcade');
  const [seed, setSeed] = useState(randomSeedCode);
  const [legend, setLegend] = useState(false);
  const sector = useMemo(() => generateLayout(seed || 'UNASSIGNED'), [seed]);
  const mechs = getAllMechs(garage),
    frame = frameOf(garage.equipped),
    v = VEHICLES[frame],
    build = buildConfig(garage.equipped);
  const condition = conditionFor(seed || 'UNASSIGNED');
  const index = VEHICLE_ORDER.indexOf(frame) + 1;
  const active = mechs.find((m) => m.id === garage.activeMechId);
  const name = active?.isPrebuilt === false ? garage.mechName : v.name.split(' ')[0];
  if (building)
    return (
      <MechBuilder
        garage={garage}
        onBuild={(g) => {
          onGarage(g);
          setBuilding(false);
        }}
        onCancel={() => setBuilding(false)}
        accent="#c0f069"
      />
    );
  return (
    <div className="op-console">
      <header className="op-bar">
        <div className="op-bar-inner">
          <div className="op-brand">
            <Crest />
            <div>
              <b>STEEL HORIZON</b>
              <small>MECH COMBAT SYSTEM</small>
            </div>
          </div>
          <nav aria-label="Command navigation">
            {tabs.map((t, i) => (
              <button key={t} aria-current={page === t ? 'page' : undefined} onClick={() => setPage(t)}>
                <Icon name={['armor', 'radar', 'wrench', 'clock'][i]} size={15} />
                {t}
              </button>
            ))}
          </nav>
          <div className="op-tools">
            <span className="op-credit">
              <Icon name="coin" size={16} />
              {garage.credits.toLocaleString('en-US')} <em>CR</em>
            </span>
            <button
              onClick={() => setPage(page === 'Settings' ? 'Hangar' : 'Settings')}
              title="Settings"
              aria-label="Settings"
            >
              <Icon name="gear" size={18} />
            </button>
            <FullscreenButton />
          </div>
        </div>
      </header>
      <main className="op-main">
        <div className="op-path">
          <span>
            COMMAND CENTER <i>/</i> <b>{page.toUpperCase()}</b>
          </span>
          <span className="op-online">
            <i /> SYSTEM ONLINE
          </span>
        </div>
        {page === 'Hangar' ? (
          <>
            <section className={'op-hero op-' + frame} aria-label="Active chassis">
              <img className="op-hero-art" src={frame === 'warden' ? hero : photos[frame]} alt="" />
              <div className="op-vignette" />
              <div className="op-cam">
                <i /> CAM_0{index} <span>/</span> LIVE FEED
              </div>
              <div className="op-hero-copy">
                <div className="op-kicker">
                  <i /> ACTIVE CHASSIS <span>//</span> 0{index}
                </div>
                <h1>{name}</h1>
                <div className="op-class">
                  <span>{roles[frame]} class</span>
                  <b>/</b> {v.epithet}
                </div>
                <p>{desc[frame]}</p>
                <div className="op-stats">
                  {[
                    ['armor', 'Hull', build.maxHp, 'HP'],
                    ['shield', 'Shield', build.shield, 'SP'],
                    ['bolt', 'Speed', Math.round(build.maxSpeed * 3.2), 'KM/H'],
                  ].map(([icon, label, value, unit]) => (
                    <div key={label}>
                      <small>
                        <Icon name={String(icon)} size={13} />
                        {label}
                      </small>
                      <strong>
                        {value} <em>{unit}</em>
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="op-viewfinder" aria-hidden="true">
                <i />+<i />
              </div>
              <a href="#deploy-panel" className="op-mobile-setup">
                Deployment ↓
              </a>
              <button className="manual-jump" onClick={() => setPage('Field manual')}>
                <Icon name="radar" size={14} /> Field manual ↗
              </button>
            </section>
            <div className="op-deck">
              <section className="op-bay">
                <Section
                  n="01"
                  aside={
                    <button className="op-build" onClick={() => setBuilding(true)}>
                      <b>+</b> Build mech
                    </button>
                  }
                >
                  Chassis bay
                </Section>
                <div className="op-cards">
                  {mechs.map((m, i) => {
                    const chosen = m.id === garage.activeMechId;
                    return (
                      <article key={m.id} className={'op-card ' + (chosen ? 'chosen' : '')}>
                        <button
                          className="op-select"
                          aria-pressed={chosen}
                          onClick={() => {
                            onGarage(selectMech(garage, m.id));
                          }}
                        >
                          <div className={'op-thumb thumb-' + m.frame}>
                            <img src={photos[m.frame]} alt="" />
                            <small>UNIT / {pad(i + 1)}</small>
                            {chosen && <span aria-label="Selected">✓</span>}
                          </div>
                          <div className="op-card-label">
                            <b>{m.isPrebuilt ? VEHICLES[m.frame].name.split(' ')[0] : m.name}</b>
                            <small>
                              <i /> {m.isPrebuilt ? roles[m.frame] + ' class' : 'Custom build'}
                            </small>
                          </div>
                        </button>
                        {!m.isPrebuilt && (
                          <button
                            className="op-sell"
                            onClick={() => {
                              const res = sellCustomMech(garage, m.id);
                              if (res.ok) onGarage(res.state);
                            }}
                          >
                            Sell · {Math.floor(m.cost / 2)} CR
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>
                <Section
                  n="02"
                  aside={
                    <button className="op-link" onClick={() => setLegend(!legend)}>
                      {legend ? 'Loadout' : 'Pilot dossier'} ↗
                    </button>
                  }
                >
                  {legend ? 'Pilot dossier' : 'Weapon loadout'}
                </Section>
                {legend ? (
                  <p className="op-story">
                    {v.backstory} {v.style}
                  </p>
                ) : (
                  <div className="op-sockets">
                    {Object.values(build.loadout).map((id, i) => (
                      <div key={i} title={id ? WEAPON_INFO[id].description : 'Empty socket'}>
                        <Icon name={id ? WEAPON_INFO[id].icon : 'lock'} size={23} />
                        <span>
                          <small>{['PRIMARY', 'SECONDARY', 'SPECIAL Q', 'SPECIAL E'][i]}</small>
                          <b>{id ? WEAPON_INFO[id].short : 'EMPTY'}</b>
                          {id && (
                            <em className="socket-cost">
                              {
                                [
                                  build.powerCost.primary,
                                  build.powerCost.secondary,
                                  build.powerCost.specialQ,
                                  build.powerCost.specialE,
                                ][i]
                              }{' '}
                              kJ / use{i >= 2 && ` · ${RACK_CAPACITIES[i === 2 ? 'Q' : 'E']} charges`}
                            </em>
                          )}
                        </span>
                        <kbd>{['LMB', 'RMB', 'Q', 'E'][i]}</kbd>
                      </div>
                    ))}
                  </div>
                )}
                <div className="bus-readout">
                  <span>
                    <Icon name="battery" size={15} /> REACTOR BUS
                  </span>
                  <b>
                    {build.powerCapacity} kJ <i>reserve</i>
                  </b>
                  <b>
                    +{Math.round(reserveRecharge(build.powerOutput, condition.energy))} kJ/s <i>recharge</i>
                  </b>
                </div>
              </section>
              <aside id="deploy-panel" className="op-deploy">
                <div className="op-panel-title">
                  <Icon name="target" size={18} />
                  <h2>Deployment</h2>
                  <span>OPS / 01</span>
                </div>
                <div className="op-recon">
                  <svg viewBox="-320 -180 640 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                    {sector.roads.map((r, i) => (
                      <polyline
                        key={i}
                        points={r.map((p) => p.join(',')).join(' ')}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                    ))}
                    {sector.districts.map((d, i) => (
                      <g key={i} transform={`translate(${d.x},${d.z})`}>
                        <circle
                          r={d.r}
                          fill="none"
                          stroke="currentColor"
                          strokeDasharray="8 6"
                          strokeWidth="2"
                        />
                        <circle r="7" fill="currentColor" />
                      </g>
                    ))}
                  </svg>
                  <div>
                    <small>PROCEDURAL SECTOR</small>
                    <strong>{sector.theme.name}</strong>
                    <p>
                      {condition.name} · {condition.detail}
                    </p>
                  </div>
                  <Icon name="radar" size={30} />
                </div>
                <div className="op-deploy-inner">
                  <label htmlFor="sector">Sector seed</label>
                  <div className="op-seed">
                    <input
                      id="sector"
                      value={seed}
                      onBlur={() => {
                        if (!seed) setSeed(randomSeedCode());
                      }}
                      maxLength={8}
                      spellCheck={false}
                      onChange={(e) => setSeed(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                    />
                    <button
                      aria-label="Reroll sector seed"
                      title="Reroll sector seed"
                      onClick={() => setSeed(randomSeedCode())}
                    >
                      <Icon name="reload" size={16} />
                    </button>
                  </div>
                  <label>Drive mode</label>
                  <div className="op-modes">
                    {(['arcade', 'realistic'] as const).map((m) => (
                      <button key={m} aria-pressed={m === controls} onClick={() => setControls(m)}>
                        {m === 'arcade' ? 'Arcade' : 'Simulation'}
                      </button>
                    ))}
                  </div>
                  <button
                    className="op-launch"
                    onClick={() => onStart(frame, controls, seed || randomSeedCode())}
                  >
                    <span className="op-play">▸</span> Deploy to arena <span>→</span>
                  </button>
                </div>
              </aside>
            </div>
          </>
        ) : page === 'Field manual' ? (
          <FieldManual />
        ) : page === 'Enemy intel' ? (
          <>
            <Section n="INT">Enemy intelligence</Section>
            <p className="op-lead">Identify the threat. Choose your counter before deployment.</p>
            <div className="op-dossiers">
              {Object.entries(DOSSIERS).map(([k, d], i) => (
                <article key={k}>
                  <div className="op-file">
                    <Icon name={d.icon} size={26} /> THREAT FILE / {pad(i + 1)}
                  </div>
                  <h3>{d.name}</h3>
                  <small>{d.role}</small>
                  <p>{d.strength}</p>
                  <label>COUNTERMEASURE</label>
                  <p>{d.counter}</p>
                </article>
              ))}
            </div>
            <div className="op-tip">
              <Icon name="smoke" /> VEIL SMOKE{' '}
              <span>
                Smoke stops incoming machine-gun rounds. Shells and rockets penetrate at 70% damage; rockets
                lose guidance. Spotted enemies can still fire blind, so move after deploying it.
              </span>
            </div>
            <div className="op-tip">
              <Icon name="radar" /> FIELD RELAYS{' '}
              <span>
                Hold inside a beacon ring for two seconds. Green repairs your hull; amber grants rapid reload.
                Each relay works once per sector.
              </span>
            </div>
          </>
        ) : page === 'Settings' ? (
          <>
            <Section n="SYS">Cockpit settings</Section>
            <div className="op-settings">
              <SettingsPanel settings={settings} onChange={onSettings} accent="#bfea6d" />
            </div>
          </>
        ) : (
          <>
            <Section n="LOG">Combat log</Section>
            <div className="op-records">
              {records.length ? (
                records.map((r, i) => (
                  <div key={i}>
                    <b>#{pad(i + 1)}</b>
                    <span>
                      {VEHICLES[r.vehicle]?.shortName ?? 'MECH'} / {r.seed}
                    </span>
                    <span>
                      WAVE {pad(r.wave)} · {r.kills} KILLS
                    </span>
                    <strong>{r.score.toLocaleString()} PTS</strong>
                  </div>
                ))
              ) : (
                <p>No sorties recorded. Deploy to the arena to log your first run.</p>
              )}
            </div>
          </>
        )}
        <footer className="op-foot">
          <span>
            <i /> IRON COLOSSEUM <b>//</b> OPERATIONS TERMINAL
          </span>
          <span>
            SH-OS <b>/</b> V.2.0
          </span>
        </footer>
      </main>
    </div>
  );
}
