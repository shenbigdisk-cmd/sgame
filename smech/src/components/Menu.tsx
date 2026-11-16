import { useState } from 'react';
import type { ControlMode, VehicleType, WeaponId } from '../game/types';
import { VEHICLE_ORDER, VEHICLES, WEAPON_COUNT, WEAPON_INFO } from '../game/vehicles';
import { buildConfig, frameOf } from '../game/forge';
import type { GarageState } from '../game/garage';
import { randomSeedCode } from '../game/world';
import type { Settings } from '../game/settings';
import type { RunRecord } from '../game/records';
import wardenImage from '../assets/mech.jpg';
import pyreImage from '../assets/cinder.jpg';
import glacierImage from '../assets/phantom.jpg';
import { Icon } from './Icons';
import SettingsPanel from './SettingsPanel';
import Forge from './Forge';
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

type Tab = 'arsenal' | 'forge' | 'legend' | 'config' | 'records';

const pad = (n: number, w = 2) => String(Math.max(0, Math.floor(n))).padStart(w, '0');
const credits = (n: number) => n.toLocaleString('en-US');

export default function Menu({ onStart, settings, onSettings, records, garage, onGarage }: Props) {
  const [controls, setControls] = useState<ControlMode>('arcade');
  const [seed, setSeed] = useState(() => randomSeedCode());
  const [tab, setTab] = useState<Tab>('arsenal');

  // The frame the player has bolted their build onto.
  const frame = frameOf(garage.equipped);
  const vehicle = VEHICLES[frame];
  const build = buildConfig(garage.equipped);
  const loadout = (Object.keys(build.loadout) as (keyof typeof build.loadout)[]).map((slot) => ({
    slot,
    id: build.loadout[slot] as WeaponId,
  }));

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
            <span className="header-credits" title="Credits earned in the pits, spent in the forge">
              {credits(garage.credits)} CR
            </span>
          </div>
          <FullscreenButton />
        </header>

        <main className={`hangar-main${tab === 'forge' ? ' is-forge' : ''}`}>
          <div className="chassis-intro" key={frame}>
            <div className="eyebrow"><span className="eyebrow-line" /> GLADIATOR <span className="eyebrow-number">/ 0{VEHICLE_ORDER.indexOf(frame) + 1}</span></div>
            <p className="chassis-role">{vehicle.role} / {vehicle.epithet}</p>
            <h2>{garage.mechName}</h2>
            <div className="chassis-model">{vehicle.name} <span>/</span> BUILT IN THE FORGE</div>

            <div className="chassis-stats" aria-label="Mech specifications">
              <div><span>HULL</span><strong>{build.maxHp}</strong></div>
              <div><span>SHIELD</span><strong>{build.shield}</strong></div>
              <div><span>SPEED</span><strong>{Math.round(build.maxSpeed * 3.2)} <small>KM/H</small></strong></div>
              <div><span>STYLE</span><strong className="style-word">{vehicle.role.split(' ')[0]}</strong></div>
            </div>

            <div className="hangar-details">
            <div className="hangar-tabs" role="tablist" aria-label="Gladiator details">
              <button role="tab" aria-selected={tab === 'arsenal'} onClick={() => setTab('arsenal')}>ARSENAL</button>
              <button role="tab" aria-selected={tab === 'forge'} onClick={() => setTab('forge')}>THE FORGE</button>
              <button role="tab" aria-selected={tab === 'legend'} onClick={() => setTab('legend')}>THE LEGEND</button>
              <button role="tab" aria-selected={tab === 'config'} onClick={() => setTab('config')}>CONFIG</button>
              <button role="tab" aria-selected={tab === 'records'} onClick={() => setTab('records')}>HALL OF FAME</button>
              <span>{credits(garage.credits)} CREDITS</span>
            </div>
            {tab === 'arsenal' ? <div className="hangar-panel loadout-weapons loadout-weapons-4" role="tabpanel" aria-label="Arsenal">
              {loadout.map(({ slot, id }) => (
                <div className="loadout-weapon" key={slot}>
                  <div className="loadout-key">{SLOT_KEYS[slot]}</div>
                  <Icon name={WEAPON_INFO[id].icon} size={19} />
                  <div>
                    <strong>{WEAPON_INFO[id].name}</strong>
                    <span className="slot-tag">{SLOT_LABELS[slot]}</span>
                    <span>{WEAPON_INFO[id].description}</span>
                  </div>
                </div>
              ))}
              <div className="loadout-weapon loadout-note" style={{ gridColumn: '1 / -1' }}>
                <div className="loadout-key" style={{ opacity: 0.4 }}>+</div>
                <div>
                  <strong>THE FORGE</strong>
                  <span className="slot-tag">CUSTOM BUILD</span>
                  <span>Spend the credits you earn in the sand on new frames, weapons, armour, reactors and drives. Everything you mount is yours to keep.</span>
                </div>
              </div>
            </div> : tab === 'forge' ? <div className="hangar-panel" role="tabpanel" aria-label="The forge">
              <Forge garage={garage} onChange={onGarage} accent={vehicle.accent} />
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

        <section className="vehicle-selection" aria-label="Choose your frame">
          <div className="selection-heading"><span>CHOOSE YOUR FRAME</span><span>03 FRAMES · {WEAPON_COUNT} UNIQUE WEAPONS</span></div>
          <div className="vehicle-list vehicle-list-3">
            {VEHICLE_ORDER.map((id, index) => {
              const item = VEHICLES[id];
              const active = frame === id;
              return (
                <button
                  className={`vehicle-option ${active ? 'is-selected' : ''}`}
                  type="button"
                  key={id}
                  onClick={() => onGarage({ ...garage, equipped: { ...garage.equipped, frame: `f_${id}` } })}
                  aria-pressed={active}
                >
                  <div className="vehicle-thumbnail"><img src={IMAGES[id]} alt="" loading="eager" /></div>
                  <div className="vehicle-option-copy"><span>0{index + 1} / {item.role}</span><strong>{item.shortName}</strong><em>“{item.epithet}”</em></div>
                  {active && <div className="selected-indicator" />}
                </button>
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
