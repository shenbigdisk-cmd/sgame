import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';
import { CAMPAIGN_MISSIONS } from '../game/campaign';
import CampaignHUD from './CampaignHUD';

beforeAll(() => {
  // @ts-expect-error React act environment flag
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

const mission = CAMPAIGN_MISSIONS[0];
const hudProps = {
  objectives: mission.objectives,
  stage: 2,
  transmission: null,
  extractionReady: false,
  missionTitle: mission.title,
  operationName: mission.operationName,
};

describe('campaign in-sortie HUD', () => {
  it('shows only live objectives for the current stage, not the full mission list', () => {
    const html = renderToStaticMarkup(<CampaignHUD {...hudProps} />);
    const active = mission.objectives.find((obj) => obj.stage === 2)!;
    const previous = mission.objectives.find((obj) => obj.stage === 1)!;
    const future = mission.objectives.find((obj) => obj.stage === 3)!;

    expect(html).toContain(active.title);
    expect(html).not.toContain(previous.title);
    expect(html).not.toContain(future.title);
    expect(html).not.toContain(active.desc);
    expect(html).toContain('STAGE 2');
  });

  it('provides a clear bearing, target name, and distance', () => {
    const html = renderToStaticMarkup(
      <CampaignHUD
        {...hudProps}
        waypoints={[{ id: 'target', title: 'RIDGE AMBUSH', dist: 123, relAngle: 0.8, color: '#f59e0b', range: 35 }]}
      />,
    );
    expect(html).toContain('TURN RIGHT');
    expect(html).toContain('RIDGE AMBUSH');
    expect(html).toContain('123');
    expect(html).toContain('METRES');
  });

  it('lets the player collapse the compact mission tracker', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => root.render(<CampaignHUD {...hudProps} />));
    expect(container.textContent).toContain(mission.objectives.find((obj) => obj.stage === 2)!.title);

    const toggle = container.querySelector('button[aria-label="Collapse mission objectives"]');
    expect(toggle).not.toBeNull();
    await act(async () => toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(container.querySelector('button[aria-label="Expand mission objectives"]')).not.toBeNull();
    expect(container.textContent).not.toContain(mission.objectives.find((obj) => obj.stage === 2)!.title);

    await act(async () => root.unmount());
    container.remove();
  });
});
