import { SUPPLIES } from '../game/supplies';
import { RACK_CAPACITIES } from '../game/ordnance';
import { Icon } from './Icons';

export default function FieldManual() {
  return (
    <>
      <header className="manual-head">
        <small>PILOT REFERENCE &nbsp; / &nbsp; FM–04</small>
        <h2>Arena field manual</h2>
        <p>Know your cover, read the supply beacons, and keep enough charge for the next fight.</p>
      </header>
      <div className="manual-notes">
        {[
          [
            'blast',
            '01 / TERRAIN',
            'Breach or defend',
            'Amber bands mark structures that shells and rockets can demolish. Circle a relay’s blast screens to reach the capture ring, or punch a shortcut through them. Rock formations and bunkers remain solid.',
          ],
          [
            'battery',
            '02 / REACTOR',
            'Spend your reserve',
            'Start fully charged. Weapons draw their listed kJ per activation. If a special shows PWR, let the reactor refill. Shields restart automatically.',
          ],
          [
            'radar',
            '03 / ENCOUNTERS',
            'Read the stage',
            'Deploy normally. Stage events roll automatically: a swarm can bring low-flying Wisps, and a Salvage Rush can bring credit caches and a Jackal hunting them. No mode selection.',
          ],
        ].map(([icon, label, name, body]) => (
          <article key={name}>
            <small>
              <Icon name={icon} size={19} />
              {label}
            </small>
            <h3>{name}</h3>
            <p>{body}</p>
          </article>
        ))}
      </div>
      <div className="manual-key">
        <small>TOUCH / PILOTING</small>
        <h3>Touch controls</h3>
        <p>
          Drag on the left to move and on the right to aim. Tap or hold on the right to fire primary; drag
          after holding to aim while firing. Add a second finger on the right for secondary. To use secondary
          alone, touch with both fingers together or drag first before adding the second. Tap Q or E to use a
          special; the top-right scope button zooms.
        </p>
      </div>
      <div className="manual-key">
        <small>FORGE / HANDLING</small>
        <h3>Range, stability and disruption</h3>
        <p>
          Trigger weapons show base maximum travel in metres; cover, terrain and gravity can stop shots sooner,
          while some in-run upgrades extend reach. Stability reduces the extra spread from driving, including strafing. Stabilised legs add to the
          gun’s rating, up to 95%. Longer reach and steadier mounts cost more and often add weight, heat or
          power draw. The Volt EMP gun trades damage for a 1.5-second disruption (0.45 seconds on bosses);
          each target resists another EMP for four seconds. Sniper lock warnings are standard equipment.
        </p>
      </div>
      <div className="manual-key">
        <small>COCKPIT / FEEDBACK</small>
        <h3>Read your upgrades and status</h3>
        <p>
          A +N badge on a weapon counts its installed upgrade ranks; violet means it has evolved. Active
          effects and their remaining seconds appear at the upper left. VEILED appears only while you are
          inside smoke; VEIL SPRINT can outlast your cover. Smoke stops bullets, but heavy fire can still
          penetrate. Undetected only means enemies have not found you.
        </p>
      </div>
      <div className="manual-key">
        <small>IDENTIFICATION KEY / 09</small>
        <h3>Supply crates</h3>
        <p>
          Q holds {RACK_CAPACITIES.Q} cartridges and E holds {RACK_CAPACITIES.E}. Both mounted racks refill
          and their cooldowns reset at the start of every stage. Drive over a landed Rearm crate to add one to
          each mounted rack during a stage; crates do not reset cooldowns. Pyre’s Skyfall orbital gun calls
          down strikes over a wide area at the point under your sight. Timed pickups refresh; they don’t
          stack.
        </p>
      </div>
      <div className="supply-index">
        {Object.entries(SUPPLIES).map(([id, s]) => (
          <article key={id} style={{ '--supply': s.color } as React.CSSProperties}>
            <div className="supply-symbol">
              <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden>
                <path
                  d={s.path}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div>
              <small>{s.short}</small>
              <h4>{s.name}</h4>
              <p>{s.effect}</p>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
