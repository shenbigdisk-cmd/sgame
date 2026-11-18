import { offerName } from '../game/upgrades';
import type { CSSProperties } from 'react';
import type { HudState, UpgradeDef } from '../game/types';
import { VEHICLES, WEAPON_INFO } from '../game/vehicles';
import { Icon } from './Icons';

interface Props {
  hud: HudState;
  accent: string;
  onPick: (index: number) => void;
  onHover?: () => void;
}

const RARITY: Record<UpgradeDef['rarity'], { label: string; color: string }> = {
  common: { label: 'STANDARD', color: '#a6c8c4' },
  rare: { label: 'RARE', color: '#b4b5f0' },
  epic: { label: 'EPIC', color: '#e8c37c' },
};

export default function UpgradeScreen({ hud, accent, onPick, onHover }: Props) {
  if (!hud.offer) return null;
  const champion = Object.values(VEHICLES).find((mech) => mech.name === hud.vehicleName);
  return (
    <div className="upgrade-screen victory-screen absolute inset-0 z-30" role="dialog" aria-modal="true" aria-labelledby="upgrade-heading">
      <div className="victory-layout">
        <header className="victory-top"><span>STEEL HORIZON / THE IRON COLOSSEUM</span><span>COMBAT PAUSED</span></header>
        <div className="victory-heading">
          <div>
            <p className="victory-eyebrow">STAGE {String(hud.wave).padStart(2, '0')} / VICTORY</p>
            <h2 id="upgrade-heading"><span>{champion?.shortName ?? 'CHAMPION'}</span> PREVAILS.</h2>
            <p className="victory-copy">Choose one upgrade.</p>
          </div>
          <div className="victory-score"><span>GLORY EARNED</span><strong style={{ color: accent }}>{hud.score.toLocaleString()}</strong><small>HULL {Math.ceil(hud.hp)}/{hud.maxHp} &nbsp; SHIELD {Math.ceil(hud.shield)}/{hud.shieldMax}</small></div>
        </div>
        <div className="victory-choices">
          {hud.offer.map((upgrade, index) => {
            const rarity = RARITY[upgrade.rarity];
            const installed = hud.perks.find((perk) => perk.name === upgrade.name)?.count ?? 0;
            return (
              <button key={`${hud.wave}-${upgrade.id}`} type="button" className={`upgrade-choice victory-choice ${upgrade.evolution ? 'is-evolution' : ''}`} style={{ '--reward-color': rarity.color, animationDelay: `${index * 65}ms` } as CSSProperties}
                onClick={() => onPick(index)} onMouseEnter={onHover}>
                <div className="reward-top"><span className="reward-rarity">{rarity.label}</span><span className="reward-number">0{index + 1}</span></div>
                <div className="reward-art"><Icon name={upgrade.icon} size={44} /><div className="reward-orbit" /></div>
                <div className="reward-category">{upgrade.evolution ? 'WEAPON EVOLUTION' : upgrade.tag === 'SIGNATURE' ? 'SPECIAL POWER' : `${upgrade.tag} UPGRADE`}</div>
                <h3>{offerName(upgrade, installed)}</h3>
                {upgrade.evolves && <p className="reward-weapon">{WEAPON_INFO[upgrade.evolves].short}</p>}
                <p className="reward-description">{upgrade.desc}</p>
                <div className="reward-claim"><span>{upgrade.evolution ? 'EVOLVE WEAPON' : 'CLAIM REWARD'}</span><span>-&gt;</span></div>
              </button>
            );
          })}
        </div>
        <footer className="victory-footer"><span>CHOOSE WITH YOUR MOUSE OR PRESS 1 / 2 / 3</span><span>ONE CHOICE. A NEW WAY TO FIGHT.</span></footer>
      </div>
    </div>
  );
}
