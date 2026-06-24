import React from 'react';
import { StandingsTable } from '../components/signature.jsx';
import { DATA } from '../lib/dataView.js';

export function StandingsScreen({ ctx }) {
  return (
    <div className="page page--narrow">
      <div className="row between wrap" style={{ marginBottom: 16, gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 30, margin: 0 }}>Standings</h1>
          <p className="muted" style={{ margin: '3px 0 0', fontSize: 14 }}>Auto-sorted live as results come in.</p>
        </div>
        <span className="pill pill--live"><span className="dot" /> UPDATING LIVE</span>
      </div>
      <StandingsTable matches={ctx.matches} teams={DATA.teams} scoring={ctx.session.scoring} qualifiers={2} />
    </div>
  );
}
