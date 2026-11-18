import {reserveRecharge} from '../game/forge';
import { useMemo, useState } from 'react';
import {
  SLOT_LABELS,
  SLOT_KEYS,
  componentsForSlot,
  getComponent,
  buildStats,
  frameOf,
  type ComponentSlot,
} from '../game/forge';
import {
  buildNewMech,
  calculateBuildCost,
  generateCoolMechName,
  MAX_MECH_NAME,
  type GarageState,
} from '../game/garage';
import { VEHICLES } from '../game/vehicles';

interface Props {
  garage: GarageState;
  onBuild: (newGarage: GarageState) => void;
  onCancel: () => void;
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

export default function MechBuilder({ garage, onBuild, onCancel, accent }: Props) {
  const [selectedSlot, setSelectedSlot] = useState<ComponentSlot>('frame');
  const [draftEquipped, setDraftEquipped] = useState<Partial<Record<ComponentSlot, string>>>(() => ({
    ...garage.equipped,
  }));
  const [draftName, setDraftName] = useState(() => generateCoolMechName());
  const [error, setError] = useState<string | null>(null);

  const totalCost = useMemo(() => calculateBuildCost(draftEquipped), [draftEquipped]);
  const canAfford = garage.credits >= totalCost;
  const stats = useMemo(() => buildStats(draftEquipped), [draftEquipped]);
  const deficit = stats.powerDraw > stats.powerOutput;

  const currentFrame = frameOf(draftEquipped);
  const currentFrameVehicle = VEHICLES[currentFrame] ?? VEHICLES.warden;

  const handleBuild = () => {
    const res = buildNewMech(garage, draftName, draftEquipped);
    if (!res.ok) {
      setError('INSUFFICIENT CREDITS TO BUILD THIS MECH');
      return;
    }
    onBuild(res.state);
  };

  return (
    <div className="mech-builder-screen" style={{ '--builder-accent': accent } as React.CSSProperties}>
      {/* Top Header */}
      <header className="builder-header">
        <div className="builder-header-left">
          <button type="button" className="builder-cancel-btn" onClick={onCancel} title="Return to main hangar">
            ← CANCEL
          </button>
          <div className="builder-title-group">
            <h2>BUILD NEW MECH</h2>
            <span className="builder-subtitle">CHASSIS: {currentFrameVehicle.name.toUpperCase()}</span>
          </div>
        </div>

        {/* Callsign / Name input */}
        <div className="builder-name-box">
          <span className="builder-label">MECH DESIGNATION</span>
          <div className="flex items-center gap-2">
            <input
              className="builder-name-input"
              value={draftName}
              maxLength={MAX_MECH_NAME}
              spellCheck={false}
              aria-label="Mech callsign"
              onChange={(e) => setDraftName(e.target.value)}
            />
            <button
              type="button"
              className="builder-reroll-btn"
              onClick={() => setDraftName(generateCoolMechName())}
              title="Generate another cool sci-fi name"
            >
              🎲 REROLL
            </button>
          </div>
        </div>

        {/* Financials & Action Button */}
        <div className="builder-header-right">
          <div className="builder-wallet-info">
            <span className="builder-label">YOUR CREDITS</span>
            <strong className="builder-credits">{formatCredits(garage.credits)} CR</strong>
          </div>
          <div className="builder-cost-info">
            <span className="builder-label">BUILD COST</span>
            <strong className={`builder-cost ${canAfford ? 'text-amber-300' : 'text-red-400'}`}>
              {formatCredits(totalCost)} CR
            </strong>
          </div>
          <button
            type="button"
            disabled={!canAfford}
            onClick={handleBuild}
            className={`builder-build-btn ${canAfford ? 'is-ready' : 'is-disabled'}`}
          >
            {canAfford ? `BUILD MECH (${formatCredits(totalCost)} CR)` : `NEED ${formatCredits(totalCost)} CR`}
          </button>
        </div>
      </header>

      {error && (
        <div className="builder-error-banner">
          {error}
        </div>
      )}

      {/* Main Split Body: Slots on Left, Components on Right */}
      <div className="builder-body">
        {/* Left Column: List of Slots */}
        <aside className="builder-slots-sidebar">
          <div className="builder-panel-title">
            <span>SYSTEM SLOTS</span>
            <span>{SLOT_ORDER.length} SLOTS</span>
          </div>

          <div className="builder-slots-list">
            {SLOT_ORDER.map((slot: ComponentSlot) => {
              const isSelected = selectedSlot === slot;
              const equippedId = draftEquipped[slot];
              const comp = equippedId ? getComponent(equippedId) : undefined;
              return (
                <button
                  key={slot}
                  type="button"
                  className={`builder-slot-item ${isSelected ? 'is-selected' : ''}`}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedSlot(slot)}
                >
                  <div className="builder-slot-meta">
                    <span className="builder-slot-label">{SLOT_LABELS[slot]}</span>
                    <span className="builder-slot-key">{SLOT_KEYS[slot]}</span>
                  </div>
                  <div className="builder-slot-equipped">
                    <strong className={comp ? 'text-white' : 'text-zinc-500 italic'}>
                      {comp ? comp.name : '[ EMPTY SOCKET ]'}
                    </strong>
                    {comp && (
                      <span className="builder-slot-weight">
                        {comp.weight.toFixed(1)}T · {formatCredits(comp.cost)} CR
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Live Specs Readout at bottom of sidebar */}
          <div className="builder-specs-card">
            <div className="builder-specs-header">LIVE CHASSIS READOUT</div>
            <div className="builder-specs-grid">
              <div><span>HULL</span><strong>{stats.maxHp}</strong></div>
              <div><span>SHIELD</span><strong>{stats.shield}</strong></div>
              <div><span>SPEED</span><strong>{Math.round(stats.maxSpeed * 3.2)} <small>KM/H</small></strong></div>
              <div><span>POWER</span><strong>{stats.powerCapacity} <small>KJ</small></strong></div>
            </div>
            <div className="builder-specs-sub">
              <span>RESERVE +{Math.round(reserveRecharge(stats.powerOutput))} kJ/s</span><span>MASS: <b>{stats.mass.toFixed(1)} T</b></span>
              <span>DRIVE STABILITY: +{Math.round(stats.driveStability * 100)}%</span>
              <span className={deficit ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                {deficit ? 'POWER DEFICIT' : 'GRID BALANCED'}
              </span>
            </div>
          </div>
        </aside>

        {/* Right Column: Components Available for Selected Slot */}
        <main className="builder-components-panel">
          <div className="builder-panel-title">
            <span>AVAILABLE COMPONENTS: {SLOT_LABELS[selectedSlot]}</span>
            <span>CLICK COMPONENT TO MOUNT</span>
          </div>

          {(selectedSlot === 'primary' || selectedSlot === 'secondary' || selectedSlot === 'drive') && (
            <p className="builder-handling-help">
              Range is base maximum travel; cover and gravity can shorten it. Stability reduces extra projectile spread while moving.
              A stabilised drive adds to the weapon’s rating, up to 95%.
            </p>
          )}
          <div className="builder-components-grid">
            {/* Optional empty socket button for weapon and special slots */}
            {(selectedSlot === 'primary' || selectedSlot === 'secondary' || selectedSlot === 'specialQ' || selectedSlot === 'specialE') && (
              <div
                className={`builder-comp-card ${!draftEquipped[selectedSlot] ? 'is-mounted' : ''}`}
                onClick={() => {
                  setDraftEquipped((prev) => {
                    const next = { ...prev };
                    delete next[selectedSlot];
                    return next;
                  });
                }}
              >
                <div className="builder-comp-header">
                  <div>
                    <strong className="builder-comp-name text-zinc-400">[ EMPTY SOCKET ]</strong>
                    <span className="builder-comp-type">STRIP SOCKET · LIGHTER & FASTER</span>
                  </div>
                  <span className="builder-comp-cost">0 CR</span>
                </div>
                <p className="builder-comp-desc">
                  Strip this mount completely. Removes weight and saves power for faster sprint and recharge.
                </p>
                <div className="builder-comp-footer">
                  {!draftEquipped[selectedSlot] ? (
                    <span className="builder-badge-mounted">✔ MOUNTED</span>
                  ) : (
                    <button type="button" className="builder-equip-btn" aria-label={`Strip ${SLOT_LABELS[selectedSlot]} socket`}>STRIP SOCKET</button>
                  )}
                </div>
              </div>
            )}

            {/* List of components available for this slot */}
            {componentsForSlot(selectedSlot).map((comp) => {
              const isMounted = draftEquipped[selectedSlot] === comp.id;
              return (
                <div
                  key={comp.id}
                  className={`builder-comp-card ${isMounted ? 'is-mounted' : ''}`}
                  onClick={() => {
                    setDraftEquipped((prev) => {
                      const next = { ...prev, [selectedSlot]: comp.id };
                      // Two catalogue variants can share a weapon id (e.g. missile pods).
                      // Swap rather than silently charging for a duplicate the engine cannot mount.
                      if (selectedSlot === 'specialQ' || selectedSlot === 'specialE') {
                        const other = selectedSlot === 'specialQ' ? 'specialE' : 'specialQ';
                        const mounted = prev[other] ? getComponent(prev[other]!) : undefined;
                        if (comp.weapon && mounted?.weapon === comp.weapon) {
                          const previous = prev[selectedSlot];
                          if (previous && getComponent(previous)?.weapon !== comp.weapon) next[other] = previous;
                          else delete next[other];
                        }
                      }
                      return next;
                    });
                  }}
                >
                  <div className="builder-comp-header">
                    <div>
                      <strong className="builder-comp-name">{comp.name}</strong>
                      <span className="builder-comp-type">
                        {comp.weight.toFixed(1)} T
                        {comp.powerCapacity ? ` · ${comp.powerCapacity} KJ` : ''}
                        {comp.powerOutput ? ` · +${comp.powerOutput} KJ/S` : ''}
                        {comp.power ? ` · ${comp.power} kJ / USE` : ''}
                        {comp.power && comp.powerInterval ? ` · ${(comp.power / comp.powerInterval).toFixed(0)} KJ/S DRAW` : ''}
                      </span>
                    </div>
                    <span className="builder-comp-cost">
                      {formatCredits(comp.cost)} CR
                    </span>
                  </div>

                  <p className="builder-comp-desc">{comp.desc}</p>

                  <div className="builder-comp-specs">
                    {comp.range !== undefined ? <span>MAX RANGE: {comp.range} M</span> : null}
                    {comp.stability !== undefined ? <span>STABILITY: {Math.round(comp.stability * 100)}%</span> : null}
                    {comp.mods?.driveStability ? <span>DRIVE STABILITY: +{Math.round(comp.mods.driveStability * 100)}%</span> : null}
                    {comp.mods?.maxHp ? <span>ARMOR HP: +{comp.mods.maxHp}</span> : null}
                    {comp.mods?.shield ? <span>SHIELD: +{comp.mods.shield}</span> : null}
                    {comp.mods?.maxSpeed ? <span>SPEED: {comp.mods.maxSpeed > 0 ? '+' : ''}{Math.round(comp.mods.maxSpeed * 3.2)} KM/H</span> : null}
                    {comp.weaponStats?.mgDamage ? <span>ROUND DMG: {comp.weaponStats.mgDamage}</span> : null}
                    {comp.weaponStats?.cannonDamage ? <span>SHELL DMG: {comp.weaponStats.cannonDamage}</span> : null}
                    {comp.weaponStats?.scatterDamage ? <span>PELLET DMG: {comp.weaponStats.scatterDamage} × 6</span> : null}
                    {comp.weaponStats?.flameDamage ? <span>FIRE DMG: {comp.weaponStats.flameDamage} / TICK</span> : null}
                    {comp.weaponStats?.cryoDamage ? <span>CRYO DMG: {comp.weaponStats.cryoDamage} / TICK</span> : null}
                    {comp.weaponStats?.empDamage ? <span>EMP DMG: {comp.weaponStats.empDamage}</span> : null}
                    {comp.weaponStats?.mgInterval ? <span>ROUND INTERVAL: {comp.weaponStats.mgInterval} S + BURST PAUSE</span> : null}
                    {comp.weaponStats?.cannonReload ? <span>RELOAD: {comp.weaponStats.cannonReload} S</span> : null}
                    {comp.weaponStats?.scatterReload ? <span>RELOAD: {comp.weaponStats.scatterReload} S</span> : null}
                    {comp.weaponStats?.beamInterval ? <span>TICK: {comp.weaponStats.beamInterval} S</span> : null}
                    {comp.weaponStats?.empReload ? <span>CYCLE: {comp.weaponStats.empReload} S</span> : null}
                  </div>

                  <div className="builder-comp-footer">
                    {isMounted ? (
                      <span className="builder-badge-mounted">✔ MOUNTED IN SLOT</span>
                    ) : (
                      <button type="button" className="builder-equip-btn" aria-label={`Equip ${comp.name}`}>
                        EQUIP COMPONENT
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
