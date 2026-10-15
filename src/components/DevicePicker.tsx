import { useState } from "react";
import {
  POPULAR_DEVICES,
  searchDevices,
  detectHardware,
  type DeviceInfo,
  type DetectedHardware,
} from "../lib/devices";

type Props = {
  currentDevice: DeviceInfo;
  onSelectDevice: (device: DeviceInfo) => void;
  vramGb: number;
  onChangeVram: (vram: number) => void;
  isApple: boolean;
  onChangeApple: (apple: boolean) => void;
};

const FEATURED_CHIPS = [
  "rtx-4090",
  "rtx-4070",
  "rtx-3060-12gb",
  "apple-m4-pro-24gb",
  "apple-m3-max-64gb",
  "apple-m1-m2-m3-16gb",
  "rx-7800-xt",
  "intel-arc-b580",
];

export function DevicePicker({
  currentDevice,
  onSelectDevice,
  vramGb,
  onChangeVram,
  isApple,
  onChangeApple,
}: Props) {
  const [search, setSearch] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [detectResult, setDetectResult] = useState<DetectedHardware | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customBw, setCustomBw] = useState(currentDevice.bandwidthGBs);
  const [customRam, setCustomRam] = useState(currentDevice.systemRamGb);

  const filteredDevices = search.trim() ? searchDevices(search) : [];

  const handleDetect = async () => {
    setDetecting(true);
    setDetectResult(null);
    try {
      const res = await detectHardware();
      setDetectResult(res);
      if (res.matchedDevice) {
        onSelectDevice(res.matchedDevice);
      } else if (res.reportedMemoryGb) {
        // Fallback custom setup
        onChangeVram(res.reportedMemoryGb);
      }
    } finally {
      setDetecting(false);
    }
  };

  const handleSelect = (dev: DeviceInfo) => {
    onSelectDevice(dev);
    onChangeVram(dev.vramGb);
    onChangeApple(dev.isApple);
    setCustomBw(dev.bandwidthGBs);
    setCustomRam(dev.systemRamGb);
    setSearch("");
  };

  const applyCustom = (vram: number, apple: boolean, bw: number, ram: number) => {
    const custom: DeviceInfo = {
      id: "custom",
      name: `Custom Hardware (${vram} GB ${apple ? "Unified" : "VRAM"})`,
      shortName: `Custom ${vram}G`,
      category: "custom",
      vramGb: vram,
      systemRamGb: ram,
      bandwidthGBs: bw,
      isApple: apple,
      notes: `${vram} GB @ ${bw} GB/s`,
    };
    onSelectDevice(custom);
    onChangeVram(vram);
    onChangeApple(apple);
  };

  return (
    <div className="picker-box">
      <div className="picker-header">
        <span className="step-tag">Step 1</span>
        <h2 className="step-title">Select your computer or GPU</h2>
      </div>

      <div className="device-search-row">
        <div className="search-wrap">
          <input
            type="text"
            className="search-input"
            placeholder="Search GPUs & Macs (e.g. RTX 4090, M3 Max, RX 7800 XT, Arc)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search devices"
          />
          {search && (
            <button
              type="button"
              className="clear-btn"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        <button
          type="button"
          className="detect-btn"
          onClick={() => void handleDetect()}
          disabled={detecting}
          title="Detect hardware via WebGPU and system memory"
        >
          {detecting ? (
            "Detecting…"
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                <path d="M2 12h20" />
              </svg>
              <span>Auto-detect</span>
            </>
          )}
        </button>
      </div>

      {detectResult && (
        <div className="detect-banner fade">
          <div className="detect-content">
            <span className="detect-title">
              {detectResult.matchedDevice
                ? `Matched: ${detectResult.matchedDevice.name}`
                : "Detection info"}
            </span>
            <p className="detect-desc">{detectResult.explanation}</p>
          </div>
          <button
            type="button"
            className="dismiss-btn"
            onClick={() => setDetectResult(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Search dropdown results */}
      {search.trim().length > 0 && (
        <div className="search-results-list fade">
          {filteredDevices.length > 0 ? (
            filteredDevices.map((dev) => (
              <button
                key={dev.id}
                type="button"
                className={`search-result-item ${currentDevice.id === dev.id ? "active" : ""}`}
                onClick={() => handleSelect(dev)}
              >
                <div className="res-main">
                  <span className="res-name">{dev.name}</span>
                  <span className="res-badge">{dev.category.toUpperCase()}</span>
                </div>
                <div className="res-meta">
                  {dev.isApple ? `${dev.vramGb} GB Unified` : `${dev.vramGb} GB VRAM`} · {dev.bandwidthGBs} GB/s
                </div>
              </button>
            ))
          ) : (
            <div className="search-empty">
              No exact match found for "{search}". You can configure custom specs below.
            </div>
          )}
        </div>
      )}

      {/* Featured quick pills */}
      <div className="quick-chips">
        <span className="quick-label">Popular:</span>
        <div className="chips-list">
          {FEATURED_CHIPS.map((id) => {
            const dev = POPULAR_DEVICES.find((d) => d.id === id);
            if (!dev) return null;
            const isSelected = currentDevice.id === dev.id;
            return (
              <button
                key={dev.id}
                type="button"
                className={`chip ${isSelected ? "selected" : ""}`}
                aria-pressed={isSelected}
                onClick={() => handleSelect(dev)}
              >
                {dev.shortName}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Device Spec Card */}
      <div className="active-device-card">
        <div className="active-dev-header">
          <div className="active-dev-title-row">
            <span className="active-dev-name">{currentDevice.name}</span>
            <span className="active-dev-pill">
              {currentDevice.isApple ? "Apple Unified" : `${currentDevice.category.toUpperCase()} GPU`}
            </span>
          </div>
          <button
            type="button"
            className="toggle-custom-btn"
            onClick={() => setShowCustom(!showCustom)}
          >
            {showCustom ? "Hide custom settings" : "Edit specs / Custom"}
          </button>
        </div>

        <div className="specs-grid">
          <div className="spec-stat">
            <span className="spec-lbl">
              {currentDevice.isApple ? "Unified Memory" : "VRAM"}
            </span>
            <span className="spec-val">{vramGb} GB</span>
          </div>
          <div className="spec-stat">
            <span className="spec-lbl">System RAM</span>
            <span className="spec-val">{currentDevice.systemRamGb} GB</span>
          </div>
          <div className="spec-stat">
            <span className="spec-lbl">Memory Bandwidth</span>
            <span className="spec-val">{currentDevice.bandwidthGBs} GB/s</span>
          </div>
        </div>

        {showCustom && (
          <div className="custom-drawer fade">
            <div className="custom-grid">
              <label className="custom-field">
                <span className="custom-lbl">VRAM (GB)</span>
                <input
                  type="number"
                  min="0"
                  max="512"
                  value={vramGb}
                  onChange={(e) => {
                    const v = Number(e.target.value) || 0;
                    onChangeVram(v);
                    applyCustom(v, isApple, customBw, customRam);
                  }}
                />
              </label>

              <label className="custom-field">
                <span className="custom-lbl">System RAM (GB)</span>
                <input
                  type="number"
                  min="4"
                  max="1024"
                  value={customRam}
                  onChange={(e) => {
                    const r = Number(e.target.value) || 16;
                    setCustomRam(r);
                    applyCustom(vramGb, isApple, customBw, r);
                  }}
                />
              </label>

              <label className="custom-field">
                <span className="custom-lbl">Bandwidth (GB/s)</span>
                <input
                  type="number"
                  min="10"
                  max="5000"
                  value={customBw}
                  onChange={(e) => {
                    const b = Number(e.target.value) || 100;
                    setCustomBw(b);
                    applyCustom(vramGb, isApple, b, customRam);
                  }}
                />
              </label>
            </div>

            <label className="custom-checkbox">
              <input
                type="checkbox"
                checked={isApple}
                onChange={(e) => {
                  const ap = e.target.checked;
                  onChangeApple(ap);
                  applyCustom(vramGb, ap, customBw, customRam);
                }}
              />
              <span>Apple Unified Memory (75% macOS GPU allocation rule)</span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
