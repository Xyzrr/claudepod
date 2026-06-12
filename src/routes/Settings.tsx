import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { IconBack } from "../components/icons";
import {
  MAX_SILENCE_MS,
  MIN_SILENCE_MS,
  PLAYBACK_RATES,
} from "../../convex/appConfig";

export default function Settings() {
  const settings = useQuery(api.settings.get);
  const update = useMutation(api.settings.update);

  if (!settings) return null;

  return (
    <div className="app">
      <header className="header">
        <Link className="icon-btn" to="/" aria-label="Back">
          <IconBack />
        </Link>
        <h1 className="header-title">Settings</h1>
        <span className="icon-btn" aria-hidden="true" />
      </header>

      <main className="settings">
        <section className="settings-group">
          <h2>Voice input</h2>
          <label className="settings-row">
            <div>
              <div className="settings-label">Silence before sending</div>
              <div className="settings-help">
                How long you must be quiet before your question is sent.
              </div>
            </div>
            <div className="settings-control">
              <input
                type="range"
                min={MIN_SILENCE_MS}
                max={MAX_SILENCE_MS}
                step={250}
                value={settings.silenceMs}
                onChange={(e) => void update({ silenceMs: Number(e.target.value) })}
                style={{
                  ["--progress" as string]: `${
                    ((settings.silenceMs - MIN_SILENCE_MS) /
                      (MAX_SILENCE_MS - MIN_SILENCE_MS)) *
                    100
                  }%`,
                }}
              />
              <span className="settings-value">
                {(settings.silenceMs / 1000).toFixed(2)}s
              </span>
            </div>
          </label>
        </section>

        <section className="settings-group">
          <h2>Playback</h2>
          <label className="settings-row">
            <div>
              <div className="settings-label">Default speed</div>
            </div>
            <div className="settings-control">
              <select
                value={settings.playbackRate}
                onChange={(e) => void update({ playbackRate: Number(e.target.value) })}
              >
                {PLAYBACK_RATES.map((rate) => (
                  <option key={rate} value={rate}>
                    {rate}×
                  </option>
                ))}
              </select>
            </div>
          </label>
          <label className="settings-row">
            <div>
              <div className="settings-label">Auto-play answers</div>
              <div className="settings-help">
                Start speaking each answer as soon as audio is ready.
              </div>
            </div>
            <div className="settings-control">
              <input
                type="checkbox"
                checked={settings.autoPlay}
                onChange={(e) => void update({ autoPlay: e.target.checked })}
              />
            </div>
          </label>
        </section>
      </main>
    </div>
  );
}
