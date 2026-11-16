import { useCallback } from 'react';
import {
  SLOT_KEYS,
  SLOT_LABELS,
  buildConfig,
  componentsForSlot,
  getComponent,
  type ComponentSlot,
} from '../game/forge';
import { buyComponent, equipComponent, renameMech, type GarageState } from '../game/garage';
import { Icon } from './Icons';

interface Props {
  garage: GarageState;
  onChange: (garage: GarageState) => void;
  accent: string;
}

const SLOT_ORDER: ComponentSlot[] = [
  'frame',
  'primary',
  'secondary',
  'specialQ',
  'specialE',
  'armour',
  'reactor',
  'drive',
];

const formatCredits = (n: number) => n.toLocaleString('en-US');

/**
 * THE FORGE — buy components with the credits earned in the pits and mount
 * them on your mech.
 */
export default function Forge({ garage, onChange, accent }: Props) {
  const config = buildConfig(garage.equipped);

  const onPick = useCallback(
    (slot: ComponentSlot, id: string) => {
      const owned = garage.owned.includes(id);
      if (!owned) {
        const purchase = buyComponent(garage, id);
        if (!purchase.ok) return;
        onChange(equipComponent(purchase.state, id, slot));
        return;
      }
      onChange(equipComponent(garage, id, slot));
    },
    [garage, onChange],
  );

  const onRename = useCallback(
    (name: string) => {
      onChange(renameMech(garage, name));
    },
    [garage, onChange],
  );

  return (
    <div className="forge" style={{ '--forge-accent': accent } as React.CSSProperties}>
      <div className="forge-top">
        <div className="forge-identity">
          <span className="forge-label">MECH DESIGNATION</span>
          <input
            className="forge-name"
            value={garage.mechName}
            maxLength={18}
            spellCheck={false}
            aria-label="Mech name"
            onChange={(e) => onRename(e.target.value)}
          />
          <span className="forge-frame">
            {getComponent(garage.equipped.frame ?? '')?.name ?? 'WARDEN FRAME'} ·{' '}
            {config.loadout.primary.toUpperCase()} / {config.loadout.secondary.toUpperCase()}
          </span>
        </div>
        <div className="forge-wallet">
          <span className="forge-label">CREDITS</span>
          <strong>{formatCredits(garage.credits)}</strong>
          <span className="forge-wallet-hint">EARNED IN THE PITS</span>
        </div>
      </div>

      <div className="forge-body">
        <aside className="forge-summary" aria-label="Mech statistics">
          <h4>BUILD STATISTICS</h4>
          <div className="forge-stat">
            <span>HULL</span>
            <strong>{config.maxHp}</strong>
          </div>
          <div className="forge-stat">
            <span>SHIELD</span>
            <strong>{config.shield}</strong>
          </div>
          <div className="forge-stat">
            <span>SPEED</span>
            <strong>{Math.round(config.maxSpeed * 3.2)} KM/H</strong>
          </div>
          <div className="forge-stat">
            <span>TURN</span>
            <strong>{config.turnRate.toFixed(1)}</strong>
          </div>
          <p className="forge-summary-note">
            Every part you mount is bought with credits from past runs. Frames are always free.
          </p>
        </aside>

        <div className="forge-slots">
          {SLOT_ORDER.map((slot) => (
            <ForgeSlot
              key={slot}
              slot={slot}
              garage={garage}
              accent={accent}
              onPick={onPick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ForgeSlot({
  slot,
  garage,
  accent,
  onPick,
}: {
  slot: ComponentSlot;
  garage: GarageState;
  accent: string;
  onPick: (slot: ComponentSlot, id: string) => void;
}) {
  const equippedId = garage.equipped[slot];
  const equipped = equippedId ? getComponent(equippedId) : undefined;
  const options = componentsForSlot(slot);

  return (
    <section className="forge-slot" aria-label={SLOT_LABELS[slot]}>
      <header className="forge-slot-head">
        <span className="forge-slot-name">{SLOT_LABELS[slot]}</span>
        <span className="forge-slot-key">{SLOT_KEYS[slot]}</span>
      </header>

      <div className="forge-equipped" style={{ '--slot-accent': accent } as React.CSSProperties}>
        <Icon name={equipped?.icon ?? 'armor'} size={20} />
        <div className="forge-equipped-copy">
          <strong>{equipped?.name ?? 'EMPTY'}</strong>
          <span>{equipped?.desc ?? 'Nothing mounted in this slot.'}</span>
        </div>
      </div>

      <div className="forge-options">
        {options.map((option) => {
          const owned = garage.owned.includes(option.id);
          const mounted = equippedId === option.id;
          const affordable = garage.credits >= option.cost;
          const state = mounted ? 'is-mounted' : owned ? 'is-owned' : affordable ? 'is-buyable' : 'is-locked';
          return (
            <button
              key={option.id}
              type="button"
              className={`forge-option ${state}`}
              disabled={mounted || (!owned && !affordable)}
              onClick={() => onPick(slot, option.id)}
              title={option.desc}
            >
              <span className="forge-option-name">{option.name}</span>
              <span className="forge-option-cost">
                {mounted ? 'MOUNTED' : owned ? 'FIT' : `${formatCredits(option.cost)} CR`}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
