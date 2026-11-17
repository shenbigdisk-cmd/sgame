import { useState } from 'react';
import type { ControlMode, VehicleType, WeaponId } from '../game/types';
import { VEHICLE_ORDER, VEHICLES, WEAPON_INFO } from '../game/vehicles';
import { buildConfig, frameOf } from '../game/forge';
import {
  getAllMechs,
  selectMech,
  sellCustomMech,
  type GarageState,
} from '../game/garage';
import { randomSeedCode } from '../game/world';
import type { Settings } from '../game/settings';
import type { RunRecord } from '../game/records';
import wardenImage from '../assets/mech.jpg';
import pyreImage from '../assets/cinder.jpg';
import glacierImage from '../assets/phantom.jpg';
import { Icon } from './Icons';
import SettingsPanel from './SettingsPanel';
import MechBuilder from './MechBuilder';
import FullscreenButton from './FullscreenButton';

interface Props {
  onStart: (vehicle: VehicleType, controls: ControlMode, seed: string) => void;
  settings: Settings;
  onSettings: (settings: Settings) => void;
  records: RunRecord[];
  garage: GarageState;
  onGarage: (garage: GarageState) => void;
}

const IMAGES: Record<VehicleType, string> = {
  warden: wardenImage,
  pyre: pyreImage,
  glacier: glacierImage,
};

const SLOT_KEYS: Record<string, string> = { primary: 'LMB', secondary: 'RMB', abilityQ: 'Q', abilityE: 'E' };
const SLOT_LABELS: Record<string, string> = { primary: 'PRIMARY', secondary: 'SECONDARY', abilityQ: 'SPECIAL · Q', abilityE: 'SPECIAL · E' };

type Tab = 'arsenal' | 'legend' | 'config' | 'records';

const pad = (n: number, w = 2) => String(Math.max(0, Math.floor(n))).padStart(w, '0');
const credits = (n: number) => n.toLocaleString('en-US');

export default function Menu({ onStart, settings, onSettings, records, garage, onGarage }: Props) {
  const [controls, setControls] = useState<ControlMode>('arcade');
  const [seed, setSeed] = useState(() => randomSeedCode());
  const [tab, setTab] = useState<Tab>('arsenal');
  const [isBuilding, setIsBuilding] = useState(false);

  // All mechs: custom mechs at the start, followed by the factory mechs
  const allMechs = getAllMechs(garage);
  const frame = frameOf(garage.equipped);
  const vehicle = VEHICLES[frame];
  const build = buildConfig(garage.equipped);
  const loadout = (Object.keys(build.loadout) as (keyof typeof build.loadout)[]).map((slot) => ({
    slot,
    id: build.loadout[slot] as WeaponId | null,
  }));

  if (isBuilding) {
    return (
      <MechBuilder
        garage={garage}
        onBuild={(newGarage) => {
          onGarage(newGarage);
          setIsBuilding(false);
        }}
        onCancel={() => setIsBuilding(false)}
        accent={vehicle.accent}
      />
    );
  }

  return (
    <div className="hangar" style={{ '--chassis-accent': vehicle.accent } as React.CSSProperties}>
      <div className="hangar-art" aria-hidden="true" key={frame}>
        <img src={IMAGES[frame]} alt="" />
      </div>
      <div className="hangar-shade" aria-hidden="true" />
      <div className="hangar-content">
        <header className="hangar-header">
          <div className="brand-lockup">
            <div className="brand-mark"><span /><span /><span /></div>
            <div>
              <h1>STEEL HORIZON</h1>
              <p>THE IRON COLOSSEUM · MECH GLADIATORS</p>
            </div>
          </div>
          <div className="hangar-header-right">
            <span className="status-dot" /> THE PITS ARE OPEN <span className="header-divider" /> SECTOR {seed}
            <span className="header-credits" title="Credits earned in the pits to build new mechs">
              {credits(garage.credits)} CR
            </span>
          </div>
          <FullscreenButton />
        </header>

        <main className="hangar-main">
          <div className="chassis-intro" key={frame}>
            <div className="eyebrow"><span className="eyebrow-line" /> GLADIATOR <span className="eyebrow-number">/ 0{VEHICLE_ORDER.indexOf(frame) + 1}</span></div>
            <p className="chassis-role">{vehicle.role} / {vehicle.epithet}</p>
            <h2>{garage.mechName}</h2>
            <div className="chassis-model">{vehicle.name} <span>/</span> READY FOR BATTLE</div>

            <div className="chassis-stats" aria-label="Mech specifications">
              <div><span>HULL</span><strong>{build.maxHp}</strong></div>
              <div><span>SHIELD</span><strong>{build.shield}</strong></div>
              <div><span>SPEED</span><strong>{Math.round(build.maxSpeed * 3.2)} <small>KM/H</small></strong></div>
              <div><span>STYLE</span><strong className="style-word">{vehicle.role.split(' ')[0]}</strong></div>
            </div>

            <div className="hangar-details">
            <div className="hangar-tabs" role="tablist" aria-label="Gladiator details">
              <button role="tab" aria-selected={tab === 'arsenal'} onClick={() => setTab('arsenal')}>ARSENAL</button>
              <button role="tab" aria-selected={tab === 'legend'} onClick={() => setTab('legend')}>THE LEGEND</button>
              <button role="tab" aria-selected={tab === 'config'} onClick={() => setTab('config')}>CONFIG</button>
              <button role="tab" aria-selected={tab === 'records'} onClick={() => setTab('records')}>HALL OF FAME</button>
              <span>{credits(garage.credits)} CREDITS</span>
            </div>
            {tab === 'arsenal' ? <div className="hangar-panel loadout-weapons loadout-weapons-4" role="tabpanel" aria-label="Arsenal">
              {loadout.map(({ slot, id }) => (
                <div className={`loadout-weapon ${id ? '' : 'is-empty'}`} key={slot}>
                  <div className="loadout-key">{SLOT_KEYS[slot]}</div>
                  <Icon name={id ? WEAPON_INFO[id].icon : 'lock'} size={19} />
                  <div>
                    <strong>{id ? WEAPON_INFO[id].name : 'EMPTY SOCKET'}</strong>
                    <span className="slot-tag">{SLOT_LABELS[slot]}</span>
                    <span>{id ? WEAPON_INFO[id].description : 'Nothing mounted. A stripped mech runs lighter and faster.'}</span>
                  </div>
                </div>
              ))}
            </div> : tab === 'legend' ? <div className="hangar-panel legend-panel" role="tabpanel" aria-label="The legend">
              <p>{vehicle.backstory}</p>
              <p className="chassis-style"><span>HOW TO FIGHT:</span> {vehicle.style}</p>
            </div> : tab === 'config' ? <div className="hangar-panel" role="tabpanel" aria-label="Cockpit configuration">
              <SettingsPanel settings={settings} onChange={onSettings} accent={vehicle.accent} />
            </div> : <div className="hangar-panel" role="tabpanel" aria-label="Hall of fame">
              <div className="records-panel" style={{ marginTop: 14 }}>
                <h4>BEST RUNS IN THE PITS</h4>
                {records.length === 0 ? (
                  <div className="records-empty">NO RUNS RECORDED YET — THE SAND IS WAITING.</div>
                ) : (
                  <div className="records-list">
                    {records.map((rec, i) => (
                      <div key={`${rec.at}-${i}`} className={`records-row ${i === 0 ? 'is-best' : ''}`}>
                        <span>{pad(i + 1)}</span>
                        <span>
                          {pad(rec.score, 6)} <em>· WAVE {pad(rec.wave)} · {VEHICLES[rec.vehicle]?.shortName ?? 'MECH'} · {rec.seed}</em>
                        </span>
                        <span>{pad(rec.timeSurvived / 60)}:{pad(rec.timeSurvived % 60)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>}
            </div>
            <p className="field-note">AUTOMATIC SHIELD / EXPLOSIVE DRUMS / PROCEDURAL ARENAS</p>
          </div>
          <div className="hangar-index" aria-hidden="true"><span>GLADIATOR</span><b>0{VEHICLE_ORDER.indexOf(frame) + 1}</b><span>/ 03</span></div>
        </main>

        <section className="vehicle-selection" aria-label="Available Mechs">
          <div className="selection-heading">
            <span>MECH HANGAR</span>
            <span>SELECT CHASSIS</span>
          </div>
          <div className="vehicle-list">
            {/* BIG "BUILD NEW MECH" BUTTON NEXT TO MECH CARDS */}
            <button
              type="button"
              className="build-mech-card cursor-pointer"
              onClick={() => setIsBuilding(true)}
              aria-label="Build new mech"
            >
              <div className="build-mech-card-content">
                <span className="build-mech-icon">+</span>
                <strong className="build-mech-title">BUILD NEW MECH</strong>
                <span className="build-mech-sub">CUSTOM LOADOUT</span>
              </div>
            </button>

            {/* Mech selection cards */}
            {allMechs.map((mech, index) => {
              const item = VEHICLES[mech.frame];
              const isSelected = garage.activeMechId === mech.id || (!garage.activeMechId && index === 0);
              const isCustom = !mech.isPrebuilt;
              return (
                <div
                  key={mech.id}
                  className={`vehicle-option ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => onGarage(selectMech(garage, mech.id))}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                >
                  <div className="vehicle-thumbnail" aria-hidden="true">
                    <img src={IMAGES[mech.frame]} alt="" loading="eager" />
                  </div>
                  <div className="vehicle-card-content">
                    <div className="vehicle-card-top">
                      <span className="vehicle-card-tag">0{index + 1} / {item.shortName}</span>
                      {isCustom && (
                        <span className="vehicle-card-badge is-custom">
                          CUSTOM
                        </span>
                      )}
                    </div>

                    <div className="vehicle-card-name" title={mech.name}>
                      {mech.name}
                    </div>

                    <div className="vehicle-card-bottom">
                      <span className="vehicle-card-sub" title={isCustom ? `VALUE: ${credits(mech.cost)} CR` : `“${item.epithet}”`}>
                        {isCustom ? `${credits(mech.cost)} CR` : `“${item.epithet}”`}
                      </span>
                      {isCustom && (
                        <button
                          type="button"
                          className="vehicle-card-sell"
                          onClick={(e) => {
                            e.stopPropagation();
                            const res = sellCustomMech(garage, mech.id);
                            if (res.ok) onGarage(res.state);
                          }}
                          title={`Sell ${mech.name} for half price (+${credits(Math.floor(mech.cost / 2))} CR)`}
                        >
                          SELL (+{credits(Math.floor(mech.cost / 2))})
                        </button>
                      )}
                    </div>
                  </div>

                  {isSelected && <div className="selected-indicator" />}
                </div>
              );
            })}
          </div>
        </section>

        <footer className="hangar-footer">
          <div className="control-choice">
            <span>DRIVE MODE</span>
            <div role="group" aria-label="Drive mode">
              <button type="button" aria-pressed={controls === 'arcade'} className={controls === 'arcade' ? 'active' : ''} onClick={() => setControls('arcade')}>EASY</button>
              <button type="button" aria-pressed={controls === 'realistic'} className={controls === 'realistic' ? 'active' : ''} onClick={() => setControls('realistic')}>SIM</button>
            </div>
            <p>{controls === 'arcade' ? 'WASD moves relative to your view.' : 'WASD steers the hull independently.'}</p>
          </div>
          <div className="seed-choice">
            <span>SECTOR SEED</span>
            <div>
              <input aria-label="Sector seed" value={seed} maxLength={8} spellCheck={false} onChange={(e) => setSeed(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))} />
              <button type="button" onClick={() => setSeed(randomSeedCode())} aria-label="Generate a new random sector">REROLL</button>
            </div>
            <p>Every seed builds a new map.</p>
          </div>
          <div className="footer-help">LMB PRIMARY <i /> RMB / C SECONDARY <i /> Q / E SPECIALS</div>
          <button className="deploy-button" type="button" onClick={() => onStart(frame, controls, seed.trim() || randomSeedCode())}>
            <span>ENTER THE ARENA</span><span aria-hidden="true">-&gt;</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
