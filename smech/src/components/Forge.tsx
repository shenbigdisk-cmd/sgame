import { useCallback, useMemo, useState } from 'react';
import {
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
  equipComponent,
  fitOutCost,
  fitOutPreset,
  missingParts,
  unequipSlot,
  buildNewMech,
  sellCustomMech,
  selectMech,
  generateCoolMechName,
  calculateBuildCost,
  type GarageState,
} from '../game/garage';
import { VEHICLES } from '../game/vehicles';
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

export default function Forge({ garage, onChange, accent }: Props) {
  const config = buildConfig(garage.equipped);
  const stats = useMemo(() => buildStats(garage.equipped), [garage.equipped]);
  const [draftName, setDraftName] = useState(() => generateCoolMechName());
  const [buildFeedback, setBuildFeedback] = useState<string | null>(null);

  const totalBuildCost = useMemo(() => calculateBuildCost(garage.equipped), [garage.equipped]);
  const canAffordBuild = garage.credits >= totalBuildCost;

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

  const onBuildNewMech = useCallback(() => {
    const res = buildNewMech(garage, draftName, garage.equipped);
    if (!res.ok) {
      setBuildFeedback('INSUFFICIENT CREDITS TO BUILD MECH');
      return;
    }
    onChange(res.state);
    setBuildFeedback(`SUCCESS: ${res.mech?.name} CONSTRUCTED & READY!`);
    setDraftName(generateCoolMechName());
    setTimeout(() => setBuildFeedback(null), 4000);
  }, [garage, draftName, onChange]);

  const onSellMech = useCallback(
    (id: string) => {
      const res = sellCustomMech(garage, id);
      if (res.ok) {
        onChange(res.state);
        setBuildFeedback(`SOLD MECH FOR +${formatCredits(res.refund)} CREDITS`);
        setTimeout(() => setBuildFeedback(null), 4000);
      }
    },
    [garage, onChange],
  );

  const onClear = useCallback(
    (slot: ComponentSlot) => {
      onChange(unequipSlot(garage, slot));
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
          <div className="flex items-center gap-2">
            <span className="forge-label">NEW MECH DESIGNATION</span>
            <button
              type="button"
              className="px-2 py-0.5 text-[9px] font-bold tracking-wider rounded bg-white/10 hover:bg-white/20 text-zinc-300 cursor-pointer"
              onClick={() => setDraftName(generateCoolMechName())}
              title="Generate another cool sci-fi name"
            >
              🎲 REROLL NAME
            </button>
          </div>
          <input
            className="forge-name"
            value={draftName}
            maxLength={18}
            spellCheck={false}
            aria-label="Mech name"
            onChange={(e) => setDraftName(e.target.value)}
          />
          <span className="forge-frame">
            {getComponent(garage.equipped.frame ?? '')?.name ?? 'WARDEN FRAME'} ·{' '}
            {(config.loadout.primary ?? 'no weapon').toUpperCase()} / {(config.loadout.secondary ?? 'no weapon').toUpperCase()}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
          <div className="forge-wallet">
            <span className="forge-label">WALLET</span>
            <strong>{formatCredits(garage.credits)} CR</strong>
            <span className="forge-wallet-hint">EARNED IN THE PITS</span>
          </div>

          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              disabled={!canAffordBuild}
              onClick={onBuildNewMech}
              className={`px-5 py-2.5 rounded font-black tracking-widest text-xs uppercase transition-transform cursor-pointer ${
                canAffordBuild
                  ? 'bg-amber-400 hover:bg-amber-300 text-black hover:scale-[1.02] shadow-[0_0_20px_rgba(255,210,74,0.4)]'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-60'
              }`}
            >
              {canAffordBuild ? `BUILD MECH (${formatCredits(totalBuildCost)} CR)` : `NEED ${formatCredits(totalBuildCost)} CR`}
            </button>
            <span className="text-[9px] tracking-wider text-zinc-400 font-mono">
              TOTAL PARTS COST: {formatCredits(totalBuildCost)} CR
            </span>
          </div>
        </div>
      </div>

      {buildFeedback && (
        <div className="px-4 py-2 my-2 text-xs font-mono font-bold tracking-wider text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded text-center">
          {buildFeedback}
        </div>
      )}

      <div className="forge-stage">
        <FactoryView equipped={garage.equipped} accent={accent} label={draftName || garage.mechName} />

        <div className="forge-console">
          {/* Custom Mechs Collection Section */}
          <div className="forge-yard">
            <div className="forge-yard-head">
              <span>MY BUILT MECHS ({garage.customMechs?.length ?? 0})</span>
              <span className="text-[9px] text-zinc-400">SELL FOR 50% REFUND</span>
            </div>
            {(!garage.customMechs || garage.customMechs.length === 0) ? (
              <p className="forge-yard-empty">
                No custom mechs built yet. Choose parts below, name your mech, and click BUILD MECH!
              </p>
            ) : (
              <ul className="forge-yard-list">
                {garage.customMechs.map((m) => (
                  <li key={m.id} className="forge-yard-build flex items-center justify-between gap-2 p-1.5 bg-white/5 rounded">
                    <button
                      type="button"
                      className="forge-yard-load text-left flex-1"
                      onClick={() => onChange(selectMech(garage, m.id))}
                    >
                      <strong className="text-zinc-100">{m.name}</strong>
                      <span className="text-[9px] text-zinc-400 block">
                        {VEHICLES[m.frame]?.shortName ?? 'MECH'} · VALUE {formatCredits(m.cost)} CR
                      </span>
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 text-[9px] font-bold tracking-wider rounded bg-red-500/20 hover:bg-red-500/40 text-red-300 border border-red-500/40 cursor-pointer whitespace-nowrap"
                      onClick={() => onSellMech(m.id)}
                      title={`Sell ${m.name} for half price (+${formatCredits(Math.floor(m.cost / 2))} CR)`}
                    >
                      SELL (+{formatCredits(Math.floor(m.cost / 2))} CR)
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="forge-presets" role="group" aria-label="Factory blueprints">
            <div className="text-[10px] tracking-widest text-zinc-400 font-mono mb-1 font-bold">
              FACTORY BASELINES (FIXED)
            </div>
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
                    <span className="forge-preset-ready">FACTORY SPEC</span>
                  )}
                </div>
              );
            })}
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
              Build a custom mech by choosing components and clicking BUILD MECH. You can sell any custom mech at 50% price anytime.
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
