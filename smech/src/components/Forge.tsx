import { useCallback, useMemo, useState } from 'react';
import {
  HULL_DRAW,
  PRESETS,
  SLOT_KEYS,
  SLOT_LABELS,
  buildConfig,
  buildStats,
  componentsForSlot,
  getComponent,
  type ComponentSlot,
  type Preset,
} from '../game/forge';
import {
  applyPreset,
  buyComponent,
  deleteBlueprint,
  equipComponent,
  fitOutCost,
  fitOutPreset,
  loadBlueprint,
  missingParts,
  renameMech,
  saveBlueprint,
  unequipSlot,
  type GarageState,
} from '../game/garage';
import { Icon } from './Icons';
import FactoryView from './FactoryView';

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
 * THE FORGE — the factory floor.
 *
 * Buy components with the credits earned in the pits, mount them on a mech
 * and watch it assemble on the floor. Mass decides how fast it runs; the
 * reactor decides how hard it can hit without going dark.
 */
export default function Forge({ garage, onChange, accent }: Props) {
  const config = buildConfig(garage.equipped);
  const stats = useMemo(() => buildStats(garage.equipped), [garage.equipped]);
  const [draftName, setDraftName] = useState(garage.mechName);

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

  const onSaveBuild = useCallback(() => {
    onChange(saveBlueprint(garage, draftName.trim() || garage.mechName));
  }, [garage, onChange, draftName]);

  const onLoadBuild = useCallback(
    (id: string) => {
      onChange(loadBlueprint(garage, id));
    },
    [garage, onChange],
  );

  const onDeleteBuild = useCallback(
    (id: string) => {
      onChange(deleteBlueprint(garage, id));
    },
    [garage, onChange],
  );

  const onClear = useCallback(
    (slot: ComponentSlot) => {
      onChange(unequipSlot(garage, slot));
    },
    [garage, onChange],
  );

  const onRename = useCallback(
    (name: string) => {
      onChange(renameMech(garage, name));
    },
    [garage, onChange],
  );

  const onLoadPreset = useCallback(
    (preset: Preset) => {
      onChange(applyPreset(garage, preset));
    },
    [garage, onChange],
  );

  const onFitPreset = useCallback(
    (preset: Preset) => {
      const result = fitOutPreset(garage, preset);
      if (!result.ok) return;
      onChange(result.state);
    },
    [garage, onChange],
  );

  const deficit = stats.powerDraw > stats.powerOutput;

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
            {(config.loadout.primary ?? 'no weapon').toUpperCase()} / {(config.loadout.secondary ?? 'no weapon').toUpperCase()}
          </span>
        </div>
        <div className="forge-wallet">
          <span className="forge-label">CREDITS</span>
          <strong>{formatCredits(garage.credits)}</strong>
          <span className="forge-wallet-hint">EARNED IN THE PITS</span>
        </div>
      </div>

      <div className="forge-stage">
        <FactoryView equipped={garage.equipped} accent={accent} label={garage.mechName} />

        <div className="forge-console">
          <div className="forge-presets" role="group" aria-label="Factory blueprints">
            {PRESETS.map((preset) => {
              const missing = missingParts(garage, preset);
              const cost = fitOutCost(garage, preset);
              const active = garage.equipped.frame === preset.equipped.frame;
              return (
                <div key={preset.id} className={`forge-preset ${active ? 'is-active' : ''}`}>
                  <button type="button" className="forge-preset-load" onClick={() => onLoadPreset(preset)}>
                    <strong>{preset.name}</strong>
                    <span>{preset.blurb}</span>
                  </button>
                  {missing.length > 0 ? (
                    <button
                      type="button"
                      className="forge-preset-buy"
                      disabled={garage.credits < cost}
                      onClick={() => onFitPreset(preset)}
                      title={`${missing.length} part(s) missing`}
                    >
                      {missing.length} PARTS · {formatCredits(cost)} CR
                    </button>
                  ) : (
                    <span className="forge-preset-ready">READY TO DEPLOY</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="forge-yard">
            <div className="forge-yard-head">
              <span>SAVED BUILDS</span>
              <div className="forge-yard-save">
                <input
                  className="forge-yard-input"
                  value={draftName}
                  maxLength={18}
                  spellCheck={false}
                  aria-label="Name for this build"
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="NAME THIS BUILD"
                />
                <button type="button" className="forge-yard-button" onClick={onSaveBuild}>
                  SAVE
                </button>
              </div>
            </div>
            {garage.blueprints.length === 0 ? (
              <p className="forge-yard-empty">
                No builds on file yet. Assemble a mech, name it, and save it to the yard.
              </p>
            ) : (
              <ul className="forge-yard-list">
                {garage.blueprints.map((b) => (
                  <li key={b.id} className="forge-yard-build">
                    <button type="button" className="forge-yard-load" onClick={() => onLoadBuild(b.id)}>
                      <strong>{b.name}</strong>
                      <span>
                        {Object.values(b.equipped)
                          .map((id) => getComponent(id)?.name)
                          .filter(Boolean)
                          .slice(0, 3)
                          .join(' · ')}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="forge-yard-delete"
                      aria-label={`Delete ${b.name}`}
                      onClick={() => onDeleteBuild(b.id)}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="forge-readouts">
            <div className="forge-readout-grid">
              <div className="forge-stat">
                <span>HULL</span>
                <strong>{stats.maxHp}</strong>
              </div>
              <div className="forge-stat">
                <span>SHIELD</span>
                <strong>{stats.shield}</strong>
              </div>
              <div className="forge-stat">
                <span>SPEED</span>
                <strong>{Math.round(stats.maxSpeed * 3.2)} KM/H</strong>
              </div>
              <div className="forge-stat">
                <span>TURN</span>
                <strong>{stats.turnRate.toFixed(1)}</strong>
              </div>
            </div>

            <div className="forge-gauge">
              <div className="forge-gauge-head">
                <span>MASS</span>
                <strong>{stats.mass.toFixed(1)} T</strong>
              </div>
              <div className="forge-gauge-bar">
                <i
                  style={{
                    width: `${Math.min(100, (stats.massFactor / 1.35) * 100)}%`,
                    background: stats.massFactor > 1.05 ? '#7fe0c0' : stats.massFactor < 0.9 ? '#ffb347' : '#8fdbe1',
                  }}
                />
              </div>
              <p className="forge-gauge-note">
                {stats.massFactor > 1.05
                  ? 'LIGHT — THE LEGS GET THE POWER'
                  : stats.massFactor < 0.9
                    ? 'HEAVY — THE ENGINE IS WORKING'
                    : 'STANDARD LOADOUT'}
              </p>
            </div>

            <div className={`forge-gauge ${deficit ? 'is-deficit' : ''}`}>
              <div className="forge-gauge-head">
                <span>POWER</span>
                <strong>{stats.powerCapacity} KJ</strong>
              </div>
              <div className="forge-gauge-bar">
                <i
                  style={{
                    width: `${Math.min(100, (stats.powerOutput / Math.max(1, stats.powerDraw)) * 100)}%`,
                    background: deficit ? '#ff8a3d' : '#7fe0c0',
                  }}
                />
              </div>
              <p className="forge-gauge-note">
                OUTPUT {stats.powerOutput} KJ/S · DRAW {stats.powerDraw.toFixed(0)} KJ/S
                {deficit ? ' · REACTOR CANNOT SUSTAIN THE LOAD' : ' · GRID BALANCED'}
              </p>
            </div>

            <p className="forge-summary-note">
              Every part you mount is bought with credits from past runs. Frames are always free.
              Hull systems draw {HULL_DRAW} KJ/S on their own.
            </p>
          </div>
        </div>
      </div>

      <div className="forge-slots">
        {SLOT_ORDER.map((slot) => (
          <ForgeSlot key={slot} slot={slot} garage={garage} accent={accent} onPick={onPick} onClear={onClear} />
        ))}
      </div>
    </div>
  );
}

function ForgeSlot({
  slot,
  garage,
  accent,
  onPick,
  onClear,
}: {
  slot: ComponentSlot;
  garage: GarageState;
  accent: string;
  onPick: (slot: ComponentSlot, id: string) => void;
  onClear: (slot: ComponentSlot) => void;
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
        {equipped ? (
          <div className="forge-equipped-numbers">
            <span>{equipped.weight.toFixed(1)} T</span>
            {equipped.powerCapacity ? <span>{equipped.powerCapacity} KJ</span> : null}
            {equipped.powerOutput ? <span>{equipped.powerOutput} KJ/S</span> : null}
            {equipped.power && equipped.powerInterval ? (
              <span>
                {equipped.power} KJ · {(equipped.power / equipped.powerInterval).toFixed(0)} KJ/S
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="forge-options">
        {slot !== 'frame' && slot !== 'armour' && slot !== 'reactor' && slot !== 'drive' ? (
          <button
            type="button"
            className={`forge-option forge-option-empty ${equippedId ? '' : 'is-mounted'}`}
            disabled={!equippedId}
            onClick={() => onClear(slot)}
            title="Strip this socket — less mass, one less gun"
          >
            <span className="forge-option-name">EMPTY MOUNT</span>
            <span className="forge-option-meta">STRIP THE PART</span>
            <span className="forge-option-cost">{equippedId ? 'REMOVE' : 'EMPTY'}</span>
          </button>
        ) : null}
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
              <span className="forge-option-meta">
                {option.weight.toFixed(1)} T
                {option.power && option.powerInterval
                  ? ` · ${(option.power / option.powerInterval).toFixed(0)} KJ/S`
                  : option.powerCapacity
                    ? ` · ${option.powerCapacity} KJ`
                    : ''}
              </span>
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
