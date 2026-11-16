import { useState } from 'react';
import type { ControlMode, VehicleType, WeaponId } from '../game/types';
import { VEHICLE_ORDER, VEHICLES, WEAPON_INFO } from '../game/vehicles';
import { randomSeedCode } from '../game/world';
import wardenImage from '../assets/mech.jpg';
import pyreImage from '../assets/cinder.jpg';
import glacierImage from '../assets/phantom.jpg';
import { Icon } from './Icons';
import FullscreenButton from './FullscreenButton';

interface Props {
  onStart: (vehicle: VehicleType, controls: ControlMode, seed: string) => void;
}

const IMAGES: Record<VehicleType, string> = {
  warden: wardenImage,
  pyre: pyreImage,
  glacier: glacierImage,
};

const SLOT_KEYS: Record<string, string> = { primary: 'LMB', secondary: 'RMB', abilityQ: 'Q', abilityE: 'E' };
const SLOT_LABELS: Record<string, string> = { primary: 'PRIMARY', secondary: 'SECONDARY', abilityQ: 'SPECIAL · Q', abilityE: 'SPECIAL · E' };

export default function Menu({ onStart }: Props) {
  const [selected, setSelected] = useState<VehicleType>('warden');
  const [controls, setControls] = useState<ControlMode>('arcade');
  const [seed, setSeed] = useState(() => randomSeedCode());
  const [tab, setTab] = useState<'arsenal' | 'legend'>('arsenal');
  const vehicle = VEHICLES[selected];
  const loadout = (Object.keys(vehicle.loadout) as (keyof typeof vehicle.loadout)[]).map((slot) => ({
    slot,
    id: vehicle.loadout[slot] as WeaponId,
  }));

  return (
    <div className="hangar" style={{ '--chassis-accent': vehicle.accent } as React.CSSProperties}>
      <div className="hangar-art" aria-hidden="true" key={selected}>
        <img src={IMAGES[selected]} alt="" />
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
          <div className="hangar-header-right"><span className="status-dot" /> THE PITS ARE OPEN <span className="header-divider" /> SECTOR {seed}</div>
          <FullscreenButton />
        </header>

        <main className="hangar-main">
          <div className="chassis-intro" key={selected}>
            <div className="eyebrow"><span className="eyebrow-line" /> GLADIATOR <span className="eyebrow-number">/ 0{VEHICLE_ORDER.indexOf(selected) + 1}</span></div>
            <p className="chassis-role">{vehicle.role} / {vehicle.epithet}</p>
            <h2>{vehicle.shortName}</h2>
            <div className="chassis-model">{vehicle.name} <span>/</span> READY FOR THE SAND</div>

            <div className="chassis-stats" aria-label="Vehicle specifications">
              <div><span>HULL</span><strong>{vehicle.maxHp}</strong></div>
              <div><span>SHIELD</span><strong>{vehicle.shield}</strong></div>
              <div><span>SPEED</span><strong>{Math.round(vehicle.maxSpeed * 3.2)} <small>KM/H</small></strong></div>
              <div><span>STYLE</span><strong className="style-word">{vehicle.role.split(' ')[0]}</strong></div>
            </div>

            <div className="hangar-details">
            <div className="hangar-tabs" role="tablist" aria-label="Gladiator details">
              <button role="tab" aria-selected={tab === 'arsenal'} onClick={() => setTab('arsenal')}>ARSENAL</button>
              <button role="tab" aria-selected={tab === 'legend'} onClick={() => setTab('legend')}>THE LEGEND</button>
              <span>12 UNIQUE WEAPONS</span>
            </div>
            {tab === 'arsenal' ? <div className="loadout-weapons loadout-weapons-4" role="tabpanel" aria-label="Arsenal">
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
            </div> : <div className="legend-panel" role="tabpanel" aria-label="The legend">
              <p>{vehicle.backstory}</p>
              <p className="chassis-style"><span>HOW TO FIGHT:</span> {vehicle.style}</p>
            </div>}
            </div>
            <p className="field-note">AUTOMATIC SHIELD / EXPLOSIVE DRUMS / PROCEDURAL ARENAS</p>
          </div>
          <div className="hangar-index" aria-hidden="true"><span>GLADIATOR</span><b>0{VEHICLE_ORDER.indexOf(selected) + 1}</b><span>/ 03</span></div>
        </main>

        <section className="vehicle-selection" aria-label="Select your gladiator">
          <div className="selection-heading"><span>CHOOSE YOUR GLADIATOR</span><span>03 MECHS · 12 UNIQUE WEAPONS</span></div>
          <div className="vehicle-list vehicle-list-3">
            {VEHICLE_ORDER.map((id, index) => {
              const item = VEHICLES[id];
              return (
                <button className={`vehicle-option ${selected === id ? 'is-selected' : ''}`} type="button" key={id} onClick={() => setSelected(id)} aria-pressed={selected === id}>
                  <div className="vehicle-thumbnail"><img src={IMAGES[id]} alt="" loading="eager" /></div>
                  <div className="vehicle-option-copy"><span>0{index + 1} / {item.role}</span><strong>{item.shortName}</strong><em>“{item.epithet}”</em></div>
                  {selected === id && <div className="selected-indicator" />}
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
          <div className="footer-help">LMB PRIMARY <i /> RMB SECONDARY <i /> Q / E SPECIALS</div>
          <button className="deploy-button" type="button" onClick={() => onStart(selected, controls, seed.trim() || randomSeedCode())}>
            <span>ENTER THE ARENA</span><span aria-hidden="true">-&gt;</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
